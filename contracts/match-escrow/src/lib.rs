#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, token};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    TokenAddress,
    MatchBalance(String),
    PlayerDeposit(String, Address),
}

#[contract]
pub struct MatchEscrowContract;

#[contractimpl]
impl MatchEscrowContract {
    /// Initialize the contract with an admin and the USDC token address
    pub fn init(env: Env, admin: Address, token_address: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
    }

    /// Lock funds from both players into escrow
    pub fn deposit(env: Env, match_id: String, player_address: Address, amount: i128) {
        player_address.require_auth();

        if amount <= 0 {
            panic!("Deposit amount must be positive");
        }

        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).expect("Contract uninitialized");
        let client = token::Client::new(&env, &token_address);

        // Transfer funds from player to contract
        client.transfer(&player_address, &env.current_contract_address(), &amount);

        // Update player's deposit record
        let player_key = DataKey::PlayerDeposit(match_id.clone(), player_address.clone());
        let current_player_deposit: i128 = env.storage().persistent().get(&player_key).unwrap_or(0);
        env.storage().persistent().set(&player_key, &(current_player_deposit + amount));

        // Update match total
        let match_key = DataKey::MatchBalance(match_id.clone());
        let current_match_balance: i128 = env.storage().persistent().get(&match_key).unwrap_or(0);
        env.storage().persistent().set(&match_key, &(current_match_balance + amount));
    }

    /// Release combined stake minus platform fee to winner (5% fee)
    pub fn release(env: Env, match_id: String, winner_address: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Contract uninitialized");
        admin.require_auth(); // Only admin can release

        let match_key = DataKey::MatchBalance(match_id.clone());
        let total_balance: i128 = env.storage().persistent().get(&match_key).unwrap_or(0);

        if total_balance == 0 {
            panic!("No funds to release for this match");
        }

        // Calculate fee (5%)
        let fee = (total_balance * 5) / 100;
        let winner_amount = total_balance - fee;

        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();

        // Transfer to winner
        client.transfer(&contract_address, &winner_address, &winner_amount);
        
        // Transfer fee to admin
        client.transfer(&contract_address, &admin, &fee);

        // Clear match balance
        env.storage().persistent().set(&match_key, &0_i128);
    }

    /// Refund both players if match cancelled or timed out
    /// Note: For simplicity, this expects both players' addresses to refund.
    pub fn refund(env: Env, match_id: String, player_a: Address, player_b: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Contract uninitialized");
        admin.require_auth(); // Only admin can trigger refund

        let match_key = DataKey::MatchBalance(match_id.clone());
        let total_balance: i128 = env.storage().persistent().get(&match_key).unwrap_or(0);

        if total_balance == 0 {
            panic!("No funds to refund for this match");
        }

        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();

        // Refund Player A
        let key_a = DataKey::PlayerDeposit(match_id.clone(), player_a.clone());
        let deposit_a: i128 = env.storage().persistent().get(&key_a).unwrap_or(0);
        if deposit_a > 0 {
            client.transfer(&contract_address, &player_a, &deposit_a);
            env.storage().persistent().set(&key_a, &0_i128);
        }

        // Refund Player B
        let key_b = DataKey::PlayerDeposit(match_id.clone(), player_b.clone());
        let deposit_b: i128 = env.storage().persistent().get(&key_b).unwrap_or(0);
        if deposit_b > 0 {
            client.transfer(&contract_address, &player_b, &deposit_b);
            env.storage().persistent().set(&key_b, &0_i128);
        }

        // Clear match balance
        env.storage().persistent().set(&match_key, &0_i128);
    }

    /// Read current escrow balance for a match
    pub fn get_balance(env: Env, match_id: String) -> i128 {
        let match_key = DataKey::MatchBalance(match_id);
        env.storage().persistent().get(&match_key).unwrap_or(0)
    }
}
