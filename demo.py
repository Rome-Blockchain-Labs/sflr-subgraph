import requests
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta

# GraphQL endpoint
url = 'http://127.0.0.1:27000/subgraphs/name/sflr-subgraph'

# GraphQL query
query = """
query {
  exchangeRates(first: 1000, orderBy: timestamp, orderDirection: asc) {
    rate
    timestamp
  }
  dailySnapshots(first: 1000, orderBy: date, orderDirection: asc) {
    date
    totalStaked
    totalUnstaked
    exchangeRate
    totalRewards
    stakerCount
  }
  totalStats(first: 1) {
    totalPooledFlr
    totalShares
    stakerCount
    cooldownPeriod
    redeemPeriod
    totalRewardsDistributed
  }
}
"""

# Send request to the GraphQL endpoint
response = requests.post(url, json={'query': query})
data = response.json().get('data', {})

# Process exchange rate data
exchange_rates = data.get('exchangeRates', [])
rate_timestamps = [datetime.fromtimestamp(int(item['timestamp'])) for item in exchange_rates]
rates = [int(item['rate']) / 1e18 for item in exchange_rates]

# Process daily snapshot data
daily_snapshots = data.get('dailySnapshots', [])
snapshot_dates = [datetime.fromtimestamp(int(item['date'])) for item in daily_snapshots]
total_staked = [int(item['totalStaked']) / 1e18 for item in daily_snapshots]
total_unstaked = [int(item['totalUnstaked']) / 1e18 for item in daily_snapshots]
daily_rewards = [int(item['totalRewards']) / 1e18 for item in daily_snapshots]
staker_counts = [int(item['stakerCount']) for item in daily_snapshots]

# Process total stats
total_stats = data.get('totalStats', [{}])[0]
total_pooled_flr = int(total_stats.get('totalPooledFlr', '0')) / 1e18
total_shares = int(total_stats.get('totalShares', '0')) / 1e18
total_staker_count = int(total_stats.get('stakerCount', '0'))
total_rewards_distributed = int(total_stats.get('totalRewardsDistributed', '0')) / 1e18

# Create plots
fig, axs = plt.subplots(3, 1, figsize=(12, 18))

# Exchange Rate plot
axs[0].plot(rate_timestamps, rates, marker='', linestyle='-')
axs[0].set_ylabel('Exchange Rate (FLR/sFLR)')
axs[0].set_title('SFLR Exchange Rate Over Time')
axs[0].grid(True, linestyle='--', alpha=0.7)

# Staked and Unstaked amounts plot
axs[1].plot(snapshot_dates, total_staked, label='Total Staked', marker='')
axs[1].plot(snapshot_dates, total_unstaked, label='Total Unstaked', marker='')
axs[1].set_ylabel('Amount (FLR)')
axs[1].set_title('Total Staked and Unstaked FLR Over Time')
axs[1].legend()
axs[1].grid(True, linestyle='--', alpha=0.7)

# Staker Count and Daily Rewards plot
ax2 = axs[2].twinx()
axs[2].plot(snapshot_dates, staker_counts, color='blue', label='Staker Count')
ax2.plot(snapshot_dates, daily_rewards, color='red', label='Daily Rewards')
axs[2].set_ylabel('Staker Count')
ax2.set_ylabel('Daily Rewards (FLR)')
axs[2].set_title('Staker Count and Daily Rewards Over Time')
lines1, labels1 = axs[2].get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax2.legend(lines1 + lines2, labels1 + labels2, loc='upper left')
axs[2].grid(True, linestyle='--', alpha=0.7)

# Format x-axis for all subplots
for ax in axs:
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))

plt.tight_layout()
plt.gcf().autofmt_xdate()  # Rotate and align the tick labels

# Save the plot
plt.savefig('sflr_comprehensive_analysis.png', dpi=300)
print("Plot saved as sflr_comprehensive_analysis.png")

# Print summary statistics
print("\nSummary Statistics:")
print(f"Latest Exchange Rate: {rates[-1]:.6f} FLR/sFLR")
print(f"Total Pooled FLR: {total_pooled_flr:.2f} FLR")
print(f"Total Shares: {total_shares:.2f} sFLR")
print(f"Total Staker Count: {total_staker_count}")
print(f"Total Rewards Distributed: {total_rewards_distributed:.2f} FLR")
