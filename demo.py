import requests
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta

# GraphQL endpoint
url = 'http://127.0.0.1:18000/subgraphs/name/sflr-subgraph'

# GraphQL query
query = """
query {
  exchangeRates(first: 1000, orderBy: timestamp, orderDirection: asc) {
    rate
    timestamp
  }
}
"""

# Send request to the GraphQL endpoint
response = requests.post(url, json={'query': query})
print("API Response:", response.json())

# Check if 'data' and 'exchangeRates' exist in the response
if 'data' not in response.json() or 'exchangeRates' not in response.json()['data']:
    print("Error: Unexpected API response format")
    exit(1)

data = response.json()['data']['exchangeRates']

# Check if we received any data
if not data:
    print("Error: No exchange rate data received")
    exit(1)

# Process data
timestamps = []
rates = []
for item in data:
    try:
        timestamp = datetime.fromtimestamp(int(item['timestamp']))
        rate = int(item['rate']) / 1e18  # Assuming rate is stored with 18 decimals
        timestamps.append(timestamp)
        rates.append(rate)
    except (ValueError, KeyError) as e:
        print(f"Error processing item: {item}. Error: {e}")

print(f"Processed {len(timestamps)} data points")
print("First timestamp:", timestamps[0] if timestamps else "N/A")
print("Last timestamp:", timestamps[-1] if timestamps else "N/A")
print("Min rate:", min(rates) if rates else "N/A")
print("Max rate:", max(rates) if rates else "N/A")

# Create the plot
plt.figure(figsize=(12, 6))
if timestamps and rates:
    plt.plot(timestamps, rates, marker='o', linestyle='-', markersize=2)
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.gca().xaxis.set_major_locator(mdates.WeekdayLocator())
    plt.gcf().autofmt_xdate()
    plt.ylim(min(rates) * 0.99, max(rates) * 1.01)  # Set y-axis limit to slightly below min and above max
    plt.ylabel('Exchange Rate')
    plt.title('SFLR Exchange Rate Over Time')
    plt.grid(True, linestyle='--', alpha=0.7)
else:
    plt.text(0.5, 0.5, 'No data to plot', horizontalalignment='center', verticalalignment='center')

plt.tight_layout()

# Save the plot
plt.savefig('exchange_rate_plot.png', dpi=300)
print("Plot saved as exchange_rate_plot.png")

# Additional debugging: print some of the data points
print("\nFirst 5 data points:")
for i in range(min(5, len(timestamps))):
    print(f"Timestamp: {timestamps[i]}, Rate: {rates[i]}")

print("\nLast 5 data points:")
for i in range(max(0, len(timestamps)-5), len(timestamps)):
    print(f"Timestamp: {timestamps[i]}, Rate: {rates[i]}")
