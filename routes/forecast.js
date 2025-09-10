// routes/forecast.js
const express = require("express");
const XLSX = require("xlsx");
const tf = require("@tensorflow/tfjs");
const axios = require("axios");

const router = express.Router();

/**
 * 📌 Fetch Excel dataset from GitHub and return JSON rows
 */
async function fetchExcelFromGithub() {
  const url =
    "https://raw.githubusercontent.com/bilqisodunola/Inventory-and-Assets-Management-Report/main/Inventory%20and%20Assets%20Dataset.xlsx";

  const response = await axios.get(url, { responseType: "arraybuffer" });
  const workbook = XLSX.read(response.data, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

/**
 * 📌 Helper route to list all available assets
 * GET /forecast
 */
router.get("/", async (req, res) => {
  try {
    const data = await fetchExcelFromGithub();
    const uniqueAssets = [
      ...new Set(data.map((row) => String(row["Asset Name"]).trim())),
    ];
    res.json({ availableAssets: uniqueAssets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load dataset from GitHub" });
  }
});

/**
 * 📌 Forecast demand for an asset
 * GET /forecast/:productName
 */

   
  router.get("/:productName", async (req, res) => {
  try {
    const { productName } = req.params;

    const response = await axios.get("http://127.0.0.1:5001/forecast", {
      params: { product: productName },
    });

    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Forecasting failed" });
  }
});

module.exports = router;
