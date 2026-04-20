#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Map, Vec, token};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    TokenAddress,
    TournamentPrizePool(String),                     // Total pool for tournament
    TournamentHost(String),                          // Host address to refund
    TournamentDistribution(String),                  // Distribution percentages (basis points 0-10000)
    TournamentStatus(String),                        // Status to prevent refund/modification
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Open,
    Locked,
    Completed,
}

#[contract]
pub struct UgtPrizePoolContract;

#[contractimpl]
impl UgtPrizePoolContract {
    /// Initialize with platform admin and USDC token address
    pub fn init(env: Env, admin: Address, token_address: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
    }

    /// Host deposits the entire prize pool upfront
    pub fn deposit_prize_pool(env: Env, tournament_id: String, host_address: Address, amount: i128) {
        host_address.require_auth();

        if amount <= 0 {
            panic!("Deposit amount must be positive");
        }

        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).expect("Contract uninitialized");
        let client = token::Client::new(&env, &token_address);

        // Transfer funds
        client.transfer(&host_address, &env.current_contract_address(), &amount);

        // Store prize pool and host
        let pool_key = DataKey::TournamentPrizePool(tournament_id.clone());
        let host_key = DataKey::TournamentHost(tournament_id.clone());
        let status_key = DataKey::TournamentStatus(tournament_id.clone());

        env.storage().persistent().set(&pool_key, &amount);
        env.storage().persistent().set(&host_key, &host_address);
        env.storage().persistent().set(&status_key, &Status::Open);
    }

    /// Lock distribution (e.g., basis points where 10000 = 100%)
    /// map maps rank (1, 2, 3...) to basis points (5000, 2500...)
    pub fn lock_distribution(env: Env, tournament_id: String, distribution: Map<u32, i128>) {
        let host_address: Address = env.storage().persistent().get(&DataKey::TournamentHost(tournament_id.clone())).expect("Tournament not found");
        host_address.require_auth();

        let status_key = DataKey::TournamentStatus(tournament_id.clone());
        let status: Status = env.storage().persistent().get(&status_key).unwrap_or(Status::Open);

        if status != Status::Open {
            panic!("Tournament already locked or completed");
        }

        let mut total_bp = 0;
        for (_, bp) in distribution.iter() {
            total_bp += bp;
        }

        // Platform takes 10% (1000 bp), so players get 90% (9000 bp)
        // Ensure total is 9000 to leave 10% for platform. Or if total is 10000, then we scale later.
        // Let's assume distribution must sum to exactly 10000 (100%).
        if total_bp != 10000 {
            panic!("Distribution basis points must sum to 10000");
        }

        env.storage().persistent().set(&DataKey::TournamentDistribution(tournament_id.clone()), &distribution);
        env.storage().persistent().set(&status_key, &Status::Locked);
    }

    /// Admin distributes prizes based on final Challonge rankings
    pub fn distribute_prizes(env: Env, tournament_id: String, rankings: Vec<(Address, u32)>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Contract uninitialized");
        admin.require_auth();

        let pool_key = DataKey::TournamentPrizePool(tournament_id.clone());
        let total_pool: i128 = env.storage().persistent().get(&pool_key).expect("Tournament not found");

        if total_pool == 0 {
            panic!("Prize pool is empty");
        }

        let dist_key = DataKey::TournamentDistribution(tournament_id.clone());
        let distribution: Map<u32, i128> = env.storage().persistent().get(&dist_key).expect("Distribution not locked");

        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();

        // 10% platform fee
        let platform_fee = (total_pool * 10) / 100;
        client.transfer(&contract_address, &admin, &platform_fee);

        let prize_pool = total_pool - platform_fee;

        for ranking in rankings.iter() {
            let (player_addr, rank) = ranking;
            if let Some(bp) = distribution.get(rank) {
                // Use a scaled amount to ensure basis points work
                // But the distribution logic actually means bp/10000 * original total_pool (if we take 10% separately).
                // Wait, if total distribution is 10000, we simply do:
                let player_prize = (total_pool * bp) / 10000;
                if player_prize > 0 {
                    client.transfer(&contract_address, &player_addr, &player_prize);
                }
            }
        }

        // Clean up
        env.storage().persistent().set(&pool_key, &0_i128);
        env.storage().persistent().set(&DataKey::TournamentStatus(tournament_id), &Status::Completed);
    }

    /// Refund the host if tournament is cancelled
    pub fn refund_host(env: Env, tournament_id: String) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Contract uninitialized");
        admin.require_auth();

        let status_key = DataKey::TournamentStatus(tournament_id.clone());
        let status: Status = env.storage().persistent().get(&status_key).unwrap_or(Status::Open);

        if status == Status::Completed {
            panic!("Tournament already completed");
        }

        let pool_key = DataKey::TournamentPrizePool(tournament_id.clone());
        let total_pool: i128 = env.storage().persistent().get(&pool_key).unwrap_or(0);

        if total_pool > 0 {
            let host_key = DataKey::TournamentHost(tournament_id.clone());
            let host_address: Address = env.storage().persistent().get(&host_key).unwrap();
            
            let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
            let client = token::Client::new(&env, &token_address);

            client.transfer(&env.current_contract_address(), &host_address, &total_pool);
            
            env.storage().persistent().set(&pool_key, &0_i128);
        }

        env.storage().persistent().set(&status_key, &Status::Completed);
    }
}
