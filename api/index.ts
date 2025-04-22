const express = require("express");
const serverless = require("serverless-http");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
}));
app.use(express.json());



let paymobToken = "";

// Endpoint to get the Paymob token
app.post("/paymob/auth", async (req, res) => {
    try {
        const response = await axios.post("https://accept.paymob.com/api/auth/tokens", {
            api_key: process.env.PAYMOB_API_KEY,
        });
        paymobToken = response.data.token;
        res.json({ token: paymobToken });
    } catch (err) {
        res.status(500).json({ error: "Auth failed", details: err.message });
    }
});

// Endpoint to create an order
app.post("/paymob/order", async (req, res) => {
    const { items, userId } = req.body;
    console.log(req.body);
    const orderItems = items.map(item => ({
        name: item.title,
        amount_cents: item.price * 100,
        quantity: item.quantity,
    }));

    try {
        const response = await axios.post("https://accept.paymob.com/api/ecommerce/orders", {
            auth_token: paymobToken,
            delivery_needed: "false",
            amount_cents: items.reduce((acc, item) => acc + item.price * 100, 0),
            currency: "EGP",
            items: orderItems,
        });

        res.json({ order_id: response.data.id });

    } catch (err) {
        res.status(500).json({ error: "Order creation failed", details: err.message });
    }
});


// Endpoint to get the payment key
app.post("/paymob/payment-key", async (req, res) => {
    const { amountCents, orderId, email, firstName, lastName } = req.body;

    try {
        // Refresh token if empty
        if (!paymobToken) {
            const authResponse = await axios.post("https://accept.paymob.com/api/auth/tokens", {
                api_key: process.env.PAYMOB_API_KEY,
            });
            paymobToken = authResponse.data.token;
        }

        const response = await axios.post("https://accept.paymob.com/api/acceptance/payment_keys", {
            auth_token: paymobToken,
            amount_cents: amountCents,
            expiration: 3600,
            order_id: orderId,
            billing_data: {
                apartment: "NA",
                email,
                floor: "NA",
                first_name: firstName,
                street: "NA",
                building: "NA",
                shipping_method: "NA",
                postal_code: "NA",
                city: "NA",
                country: "EG",
                state: "NA",
                phone_number: "NA",
                last_name: lastName // Make sure to include last_name
            },
            currency: "EGP",
            integration_id: process.env.PAYMOB_INTEGRATION_ID,
        });

        res.json({ token: response.data.token });
    } catch (err) {
        console.error("Full error:", err.response?.data); // Log full error details
        res.status(500).json({
            error: "Payment key failed",
            details: err.message,
            paymobError: err.response?.data?.message
        });
    }
});


module.exports.handler = serverless(app);