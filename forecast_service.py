from flask import Flask, request, jsonify
from prophet import Prophet
import pandas as pd
import requests
import io
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Fetch Excel dataset from GitHub
def fetch_data():
    url = "https://raw.githubusercontent.com/bilqisodunola/Inventory-and-Assets-Management-Report/main/Inventory%20and%20Assets%20Dataset.xlsx"
    content = requests.get(url).content
    df = pd.read_excel(io.BytesIO(content))
    return df

@app.route("/forecast", methods=["GET"])
def forecast():
    try:
        # Dummy example with fixed small dataset for testing
        data = [
            {"ds": "2025-09-10", "yhat": 3.4},
            {"ds": "2025-09-11", "yhat": 3.6},
            {"ds": "2025-09-12", "yhat": 3.7},
        ]
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


    df = fetch_data()

    # Filter rows by product
    df = df[df["Asset Name"].str.lower() == product_name.lower()]
    if df.empty:
        return jsonify({"error": "No data for this product"}), 404

    # Prepare data for Prophet
    df_prophet = df[["Purchase Date", "Quantity Available"]].copy()
    df_prophet.rename(columns={"Purchase Date": "ds", "Quantity Available": "y"}, inplace=True)

   # Ensure numeric
    df_prophet["y"] = pd.to_numeric(df_prophet["y"], errors="coerce")
    df_prophet.dropna(inplace=True)

# Check if we have at least 2 rows
    if len(df_prophet) < 2:
        return jsonify({
            "error": "Not enough data points for forecasting",
            "rows_found": len(df_prophet),
            "product": product_name
        }), 400

# Train model
    model = Prophet()
    model.fit(df_prophet)


    # Forecast next 30 days
    future = model.make_future_dataframe(periods=30)
    forecast = model.predict(future)

    # Return only forecast part
    result = forecast[["ds", "yhat"]].tail(30).to_dict(orient="records")

    return jsonify({
        "product": product_name,
        "past_points": len(df_prophet),
        "forecast": result
    })

if __name__ == "__main__":
    app.run(port=5001, debug=True)
