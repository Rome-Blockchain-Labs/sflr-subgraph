import requests
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta

# GraphQL endpoint dev
url = 'https://flare-dev-query.sceptre.fi/subgraphs/name/sflr-subgraph'
# local
# url = 'http://127.0.0.1:18000/subgraphs/name/sflr-subgraph'

# GraphQL query
query = """
query {
  exchangeRates(first: 1000, orderBy: timestamp, orderDirection: asc) {
    rate
    timestamp
  }
  accrueRewards(first: 1000, orderBy: timestamp, orderDirection: asc) {
    timestamp
    userRewardAmount
    protocolRewardAmount
  }
}
"""

# Send request to the GraphQL endpoint
response = requests.post(url, json={'query': query})
print("API Response:", response.json())

# Check if 'data' exists in the response
if 'data' not in response.json():
    print("Error: Unexpected API response format")
    exit(1)

data = response.json()['data']

# Process exchange rate data
exchange_timestamps = []
rates = []
for item in data.get('exchangeRates', []):
    try:
        timestamp = datetime.fromtimestamp(int(item['timestamp']))
        rate = int(item['rate']) / 1e18  # Assuming rate is stored with 18 decimals
        exchange_timestamps.append(timestamp)
        rates.append(rate)
    except (ValueError, KeyError) as e:
        print(f"Error processing exchange rate item: {item}. Error: {e}")

# Process accrue reward data
accrue_timestamps = []
user_rewards = []
protocol_rewards = []
for item in data.get('accrueRewards', []):
    try:
        timestamp = datetime.fromtimestamp(int(item['timestamp']))
        user_reward = int(item['userRewardAmount']) / 1e18
        protocol_reward = int(item['protocolRewardAmount']) / 1e18
        accrue_timestamps.append(timestamp)
        user_rewards.append(user_reward)
        protocol_rewards.append(protocol_reward)
    except (ValueError, KeyError) as e:
        print(f"Error processing accrue reward item: {item}. Error: {e}")

print(f"Processed {len(exchange_timestamps)} exchange rate data points")
print(f"Processed {len(accrue_timestamps)} accrue reward data points")

# Create the plots
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 12), sharex=True)

# Plot exchange rates
if exchange_timestamps and rates:
    ax1.plot(exchange_timestamps, rates, marker='o', linestyle='-', markersize=2)
    ax1.set_ylabel('Exchange Rate')
    ax1.set_title('SFLR Exchange Rate Over Time')
    ax1.grid(True, linestyle='--', alpha=0.7)
else:
    ax1.text(0.5, 0.5, 'No exchange rate data to plot', horizontalalignment='center', verticalalignment='center')

# Plot accrue rewards
if accrue_timestamps and user_rewards and protocol_rewards:
    ax2.plot(accrue_timestamps, user_rewards, marker='o', linestyle='-', markersize=2, label='User Rewards')
    ax2.plot(accrue_timestamps, protocol_rewards, marker='o', linestyle='-', markersize=2, label='Protocol Rewards')
    ax2.set_ylabel('Reward Amount')
    ax2.set_title('Accrue Rewards Over Time')
    ax2.grid(True, linestyle='--', alpha=0.7)
    ax2.legend()
else:
    ax2.text(0.5, 0.5, 'No accrue reward data to plot', horizontalalignment='center', verticalalignment='center')

# Set x-axis format
plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
plt.gca().xaxis.set_major_locator(mdates.WeekdayLocator())
plt.gcf().autofmt_xdate()

plt.tight_layout()

# Save the plot
plt.savefig('sflr_data_plot.png', dpi=300)
print("Plot saved as sflr_data_plot.png")

# Additional debugging: print some of the data points
print("\nFirst 5 exchange rate data points:")
for i in range(min(5, len(exchange_timestamps))):
    print(f"Timestamp: {exchange_timestamps[i]}, Rate: {rates[i]}")

print("\nFirst 5 accrue reward data points:")
for i in range(min(5, len(accrue_timestamps))):
    print(f"Timestamp: {accrue_timestamps[i]}, User Reward: {user_rewards[i]}, Protocol Reward: {protocol_rewards[i]}")
