import requests

URL = "https://api.goldsky.com/api/public/project_cm8re9gott8zl01u494d0hnuu/subgraphs/sflr-subgraph/0.1.5/gn"

# List of entities based on your mappings/schema
entities = [
    "stakingTransactions",
    "protocolTransactions",
    "swapTransactions",
    "accrueRewards",
    "unlockRequests",
    "accounts",
    "userMetrics",
    "exchangeRates",
    "protocolConfigs",
    "allowances",
    "configChanges",
    "invalidRewardTypeCounters"
]

def count_entities(entity):
    step = 1000
    skip = 0
    total = 0
    while True:
        query = {
            "query": f"{{ {entity}(first: {step}, skip: {skip}) {{ id }} }}"
        }
        res = requests.post(URL, json=query)
        data = res.json().get("data", {}).get(entity, [])
        count = len(data)
        total += count
        if count < step:
            break
        skip += step
    return total

grand_total = 0
print("Entity counts:")
for entity in entities:
    count = count_entities(entity)
    print(f"  {entity}: {count}")
    grand_total += count

print(f"\n🔢 Total entities stored: {grand_total}")
