from utils import db_source

print(db_source)
# Use COUNT(*) to count all rows in the table
query = "select pincode from meter_data where pincode > 5000"
result = db_source.run(query)

print(result)  # Optional: print result to see the count
breakpoint()
