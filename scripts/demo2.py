import requests
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from decimal import Decimal
import pandas as pd
import seaborn as sns

# Constants
GRAPHQL_URL = 'http://127.0.0.1:27000/subgraphs/name/sflr-subgraph'
DECIMALS = Decimal('1000000000000000000')  # 1e18
TEST_ADDRESS = '0xd72bA571F2bc0662BcA09Af473d838777536dCfa'

def fetch_account_data(address):
    query = """
    query($address: ID!) {
        account(id: $address) {
            id
            balance
            totalTransferred
            totalReceived
            lastUpdated
            allowances {
                spender
                amount
                lastUpdated
            }
            unlockRequests {
                startedAt
                shareAmount
                status
                redeemableAt
                expiresAt
                redemptionTransaction
            }
            transactions {
                id
                type
                flrAmount
                sflrAmount
                exchangeRate
                timestamp
                status
                fromAddress
                toAddress
                spender
            }
        }
    }
    """

    response = requests.post(GRAPHQL_URL, 
                             json={'query': query, 
                                   'variables': {'address': address.lower()}})
    if response.status_code != 200:
        raise Exception(f"Query failed: {response.status_code}")

    return response.json().get('data', {}).get('account', {})

def fetch_user_metrics(address):
    query = """
    query($address: ID!) {
        userMetric(id: $address) {
            currentShares
            totalStaked
            totalUnstaked
            totalRewardsEarned
            lastInteractionTime
            transactionCount
            custodiedShares
            activeUnlockRequestCount
            totalTransferCount
            totalRewardsClaimed
            firstInteractionTime
        }
    }
    """

    response = requests.post(GRAPHQL_URL, 
                             json={'query': query, 
                                   'variables': {'address': address.lower()}})
    if response.status_code != 200:
        raise Exception(f"Query failed: {response.status_code}")

    return response.json().get('data', {}).get('userMetric', {})

def fetch_user_rewards(address):
    query = """
    query($address: ID!) {
        stakingTransactions(
            where: {
                user: $address,
                type_in: ["stake", "redeem", "withdraw"]
            },
            orderBy: timestamp,
            orderDirection: asc
        ) {
            type
            timestamp
            flrAmount
            sflrAmount
        }
        account(id: $address) {
            balance
        }
    }
    """

    response = requests.post(GRAPHQL_URL, 
                             json={'query': query, 
                                   'variables': {'address': address.lower()}})
    if response.status_code != 200:
        raise Exception(f"Query failed: {response.status_code}")

    return response.json().get('data', {})

def calculate_reward_stats(address):
    print("\n=== Reward Analysis ===")

    data = fetch_user_rewards(address)
    if not data or not data.get('stakingTransactions'):
        print("No staking transactions found")
        return

    df = pd.DataFrame(data['stakingTransactions'])
    df['timestamp'] = pd.to_datetime(df['timestamp'].astype(int), unit='s')
    df['flrAmount'] = df['flrAmount'].apply(lambda x: Decimal(x) / DECIMALS)
    df['sflrAmount'] = df['sflrAmount'].apply(lambda x: Decimal(x) / DECIMALS)

    # Calculate total staked and withdrawn
    total_staked = df[df['type'] == 'stake']['flrAmount'].sum()
    total_withdrawn = df[df['type'].isin(['redeem', 'withdraw'])]['flrAmount'].sum()
    current_balance = Decimal(data['account'].get('balance', '0')) / DECIMALS

    # Calculate stats
    print(f"Total Staked: {total_staked:.6f} FLR")
    print(f"Total Withdrawn: {total_withdrawn:.6f} FLR")
    print(f"Current SFLR Balance: {current_balance:.6f} SFLR")

    if total_staked > 0:
        total_value = total_withdrawn + current_balance
        total_profit = total_value - total_staked
        roi_percentage = (total_profit / total_staked) * 100

        # Calculate time-based metrics
        if len(df) > 0:
            first_stake = df[df['type'] == 'stake']['timestamp'].min()
            time_delta = (datetime.now() - first_stake).days

            if time_delta > 0:
                apy = (roi_percentage * 365) / time_delta
                daily_reward_rate = roi_percentage / time_delta

                print(f"\nTime since first stake: {time_delta} days")
                print(f"Total Profit: {total_profit:.6f} FLR")
                print(f"ROI: {roi_percentage:.2f}%")
                print(f"Estimated APY: {apy:.2f}%")
                print(f"Daily Reward Rate: {daily_reward_rate:.4f}%")

    # Plot cumulative rewards over time
    plt.figure(figsize=(12, 6))

    # Create cumulative value timeline with corrected profit calculation
    timeline = df.copy()
    # Track both FLR and SFLR positions
    timeline['flr_change'] = timeline.apply(
        lambda x: -x['flrAmount'] if x['type'] == 'stake' else x['flrAmount'], 
        axis=1
    )
    timeline['sflr_change'] = timeline.apply(
        lambda x: x['sflrAmount'] if x['type'] == 'stake' else -x['sflrAmount'], 
        axis=1
    )

    # Calculate cumulative positions
    timeline['cumulative_flr'] = timeline['flr_change'].cumsum()
    timeline['cumulative_sflr'] = timeline['sflr_change'].cumsum()

    # Get current exchange rate for SFLR valuation
    exchange_rate_query = """
    {
        exchangeRates(first: 1, orderBy: timestamp, orderDirection: desc) {
            rate
        }
    }
    """
    exchange_rate_response = requests.post(GRAPHQL_URL, json={'query': exchange_rate_query})
    current_rate = Decimal(exchange_rate_response.json()['data']['exchangeRates'][0]['rate']) / DECIMALS

    # Calculate total value at each point (FLR withdrawn + SFLR value)
    timeline['total_value'] = timeline['cumulative_flr'] + (timeline['cumulative_sflr'] * current_rate)

    # Plot
    plt.plot(timeline['timestamp'], timeline['total_value'], 
             marker='o', label='Total Value (FLR + SFLR)')
    plt.axhline(y=0, color='r', linestyle='--', alpha=0.3)

    plt.title(f'Portfolio Value Over Time for {address}')
    plt.xlabel('Date')
    plt.ylabel('Value in FLR')
    plt.legend()
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.gcf().autofmt_xdate()
    plt.tight_layout()
    plt.savefig('address_rewards.png', dpi=300)

def analyze_account(address):
    print(f"\nAnalyzing address: {address}")

    # Fetch data
    account_data = fetch_account_data(address)
    metrics_data = fetch_user_metrics(address)


    if not account_data:
        print("No account data found")
        return

    # Basic account info
    print("\n=== Account Overview ===")
    print(f"Current Balance: {Decimal(account_data['balance']) / DECIMALS:.6f} SFLR")
    print(f"Total Transferred: {Decimal(account_data['totalTransferred']) / DECIMALS:.6f} SFLR")
    print(f"Total Received: {Decimal(account_data['totalReceived']) / DECIMALS:.6f} SFLR")
    print(f"Last Updated: {datetime.fromtimestamp(int(account_data['lastUpdated']))}")

    # Metrics
    if metrics_data:
        print("\n=== User Metrics ===")
        print(f"Total Staked: {Decimal(metrics_data['totalStaked']) / DECIMALS:.6f} FLR")
        print(f"Total Unstaked: {Decimal(metrics_data['totalUnstaked']) / DECIMALS:.6f} FLR")
        print(f"Total Rewards Earned: {Decimal(metrics_data['totalRewardsEarned']) / DECIMALS:.6f} FLR")
        print(f"Transaction Count: {metrics_data['transactionCount']}")
        print(f"Transfer Count: {metrics_data['totalTransferCount']}")
        print(f"Active Unlock Requests: {metrics_data['activeUnlockRequestCount']}")
        print(f"First Interaction: {datetime.fromtimestamp(int(metrics_data['firstInteractionTime']))}")
        print(f"Last Interaction: {datetime.fromtimestamp(int(metrics_data['lastInteractionTime']))}")

    # Analyze transactions
    transactions = account_data.get('transactions', [])
    if transactions:
        df_transactions = pd.DataFrame(transactions)
        df_transactions['timestamp'] = pd.to_datetime(df_transactions['timestamp'].astype(int), unit='s')
        df_transactions['flrAmount'] = df_transactions['flrAmount'].apply(lambda x: Decimal(x) / DECIMALS)
        df_transactions['sflrAmount'] = df_transactions['sflrAmount'].apply(lambda x: Decimal(x) / DECIMALS)

        print("\n=== Transaction Analysis ===")
        print(f"Total Transactions: {len(transactions)}")

        type_counts = df_transactions['type'].value_counts()
        print("\nTransaction Types:")
        print(type_counts)

        # Plot transaction history
        plt.figure(figsize=(12, 6))
        for tx_type in df_transactions['type'].unique():
            type_data = df_transactions[df_transactions['type'] == tx_type]
            plt.scatter(type_data['timestamp'], 
                        type_data['sflrAmount'], 
                        label=tx_type,
                        alpha=0.6)

        plt.title(f'Transaction History for {address}')
        plt.xlabel('Date')
        plt.ylabel('SFLR Amount')
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.gcf().autofmt_xdate()
        plt.tight_layout()
        plt.savefig('address_transactions.png', dpi=300, bbox_inches='tight')

    # Analyze unlock requests
    unlock_requests = account_data.get('unlockRequests', [])
    if unlock_requests:
        print("\n=== Unlock Requests ===")
        df_unlocks = pd.DataFrame(unlock_requests)
        df_unlocks['startedAt'] = pd.to_datetime(df_unlocks['startedAt'].astype(int), unit='s')
        df_unlocks['shareAmount'] = df_unlocks['shareAmount'].apply(lambda x: Decimal(x) / DECIMALS)

        print(f"Total Unlock Requests: {len(unlock_requests)}")
        status_counts = df_unlocks['status'].value_counts()
        print("\nStatus Distribution:")
        print(status_counts)

    # Calculate account reward
    calculate_reward_stats(address)

    # Analyze allowances
    allowances = account_data.get('allowances', [])
    if allowances:
        print("\n=== Active Allowances ===")
        for allowance in allowances:
            amount = Decimal(allowance['amount']) / DECIMALS
            if amount > 0:
                print(f"Spender: {allowance['spender']}")
                print(f"Amount: {amount:.6f} SFLR")
                print(f"Last Updated: {datetime.fromtimestamp(int(allowance['lastUpdated']))}")
                print("---")

def main():
    try:
        print("Analyzing SFLR address data...")
        analyze_account(TEST_ADDRESS)
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
