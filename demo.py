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

# Reward type mapping with colors
REWARD_TYPES = {
    0: {"name": "UNKNOWN", "color": "#1f77b4"},
    1: {"name": "FLAREDROPS_P_CHAIN", "color": "#ff7f0e"},
    2: {"name": "FLAREDROPS_C_CHAIN", "color": "#2ca02c"},
    3: {"name": "STAKING_REWARDS_P_CHAIN", "color": "#d62728"},
    4: {"name": "DELEGATION_REWARDS_C_CHAIN", "color": "#9467bd"},
    5: {"name": "BUYIN_STAKING_FEES", "color": "#8c564b"}
}

def fetch_all_data(entity_type):
    all_data = []
    skip = 0
    chunk_size = 1000

    while True:
        query = f"""
        query {{
            {entity_type}(
                first: {chunk_size},
                skip: {skip},
                orderBy: timestamp,
                orderDirection: asc
            ) {{
                {'rate timestamp' if entity_type == 'exchangeRates' else 'timestamp userRewardAmount protocolRewardAmount rewardType isExtended'}
            }}
        }}
        """
        
        response = requests.post(GRAPHQL_URL, json={'query': query})
        if response.status_code != 200:
            raise Exception(f"Query failed: {response.status_code}")
        
        data = response.json().get('data', {}).get(entity_type, [])
        
        if not data:
            break
            
        all_data.extend(data)
        
        if len(data) < chunk_size:
            break
            
        skip += chunk_size

    return all_data

def analyze_exchange_rates():
    rates_data = fetch_all_data('exchangeRates')

    if not rates_data:
        print("No exchange rate data found")
        return

    df = pd.DataFrame(rates_data)
    df['timestamp'] = pd.to_datetime(df['timestamp'].astype(int), unit='s')
    df['rate'] = df['rate'].apply(lambda x: Decimal(x) / DECIMALS)

    plt.figure(figsize=(12, 6))
    plt.plot(df['timestamp'], df['rate'], marker='o', linestyle='-', markersize=2)
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.gca().xaxis.set_major_locator(mdates.AutoDateLocator())
    plt.gcf().autofmt_xdate()
    plt.title('SFLR/FLR Exchange Rate')
    plt.ylabel('Exchange Rate')
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.tight_layout()
    plt.savefig('exchange_rate_plot.png', dpi=300)

    print("\nExchange Rate Analysis:")
    print(f"Number of data points: {len(df)}")
    print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"Min rate: {df['rate'].min():.18f}")
    print(f"Max rate: {df['rate'].max():.18f}")
    print(f"Rate change: {((df['rate'].iloc[-1] / df['rate'].iloc[0]) - 1) * 100:.6f}%")

def analyze_rewards():
    rewards_data = fetch_all_data('accrueRewards')

    if not rewards_data:
        print("No reward data found")
        return

    df = pd.DataFrame(rewards_data)
    df['timestamp'] = pd.to_datetime(df['timestamp'].astype(int), unit='s')
    df['userRewardAmount'] = df['userRewardAmount'].apply(lambda x: Decimal(x) / DECIMALS)
    df['protocolRewardAmount'] = df['protocolRewardAmount'].apply(lambda x: Decimal(x) / DECIMALS)
    df['rewardType'] = df['rewardType'].apply(lambda x: int(x) if x is not None else 0)
    df['rewardTypeName'] = df['rewardType'].apply(lambda x: REWARD_TYPES[x]['name'])

    print("\nReward Analysis:")
    print(f"Total number of reward events: {len(df)}")
    print(f"Total user rewards: {df['userRewardAmount'].sum():.6f} FLR")
    print(f"Total protocol rewards: {df['protocolRewardAmount'].sum():.6f} FLR")

    # Analyze by reward type
    reward_type_summary = df.groupby('rewardTypeName').agg({
        'userRewardAmount': ['count', 'sum'],
        'protocolRewardAmount': 'sum'
    }).round(6)

    print("\nRewards by type:")
    print(reward_type_summary)

    # Plot reward distributions
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 12))

    # Cumulative rewards by type
    for reward_type in df['rewardType'].unique():
        type_data = df[df['rewardType'] == reward_type]
        color = REWARD_TYPES[reward_type]['color']
        name = REWARD_TYPES[reward_type]['name']

        ax1.plot(type_data['timestamp'],
                type_data['userRewardAmount'].cumsum(),
                label=f'{name} (User)',
                color=color,
                linestyle='-')
        ax1.plot(type_data['timestamp'],
                type_data['protocolRewardAmount'].cumsum(),
                label=f'{name} (Protocol)',
                color=color,
                linestyle='--')

    ax1.set_title('Cumulative Rewards by Type')
    ax1.set_ylabel('FLR')
    ax1.grid(True, linestyle='--', alpha=0.7)
    ax1.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax1.xaxis.set_major_locator(mdates.AutoDateLocator())

    # Individual reward events by type
    for reward_type in df['rewardType'].unique():
        type_data = df[df['rewardType'] == reward_type]
        color = REWARD_TYPES[reward_type]['color']
        name = REWARD_TYPES[reward_type]['name']

        ax2.scatter(type_data['timestamp'],
                   type_data['userRewardAmount'],
                   label=f'{name} (User)',
                   color=color,
                   marker='o')
        ax2.scatter(type_data['timestamp'],
                   type_data['protocolRewardAmount'],
                   label=f'{name} (Protocol)',
                   color=color,
                   marker='^')

    ax2.set_title('Individual Reward Events by Type')
    ax2.set_ylabel('FLR')
    ax2.grid(True, linestyle='--', alpha=0.7)
    ax2.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    ax2.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax2.xaxis.set_major_locator(mdates.AutoDateLocator())

    plt.gcf().autofmt_xdate()
    plt.tight_layout()
    plt.savefig('rewards_plot.png', dpi=300, bbox_inches='tight')

    # Additional distribution plot
    plt.figure(figsize=(10, 6))
    sns.boxplot(data=df, x='rewardTypeName', y='userRewardAmount')
    plt.xticks(rotation=45)
    plt.title('Distribution of User Rewards by Type')
    plt.tight_layout()
    plt.savefig('reward_distribution_plot.png', dpi=300)

def main():
    try:
        print("Analyzing SFLR data...")
        analyze_exchange_rates()
        analyze_rewards()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
