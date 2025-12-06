const mongoose = require("mongoose");
const CartModel = require("../models/CartModel");
const ProfileModel = require("../models/ProfileModel");
const InvoiceModel = require("../models/InvoiceModel");
const InvoiceProductModel = require("../models/InvoiceProductModel");
const PaymentSettingModel = require("../models/PamentSettingModel");
const ObjectID = mongoose.Types.ObjectId
const FormData = require('form-data');
const axios = require("axios");

const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5020}`;
const FRONTEND_BASE_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const PAYMENT_GATEWAY_MODE = (process.env.PAYMENT_GATEWAY_MODE || "auto").toLowerCase();
const ALLOW_PAYMENT_FALLBACK = process.env.ALLOW_PAYMENT_FALLBACK !== "false";
const defaultPaymentSettings = {
    store_id: process.env.DEFAULT_SSL_STORE_ID || "teamr600c004f8da4d",
    store_passwd: process.env.DEFAULT_SSL_STORE_PASSWORD || "teamr600c004f8da4d@ssl",
    currency: process.env.DEFAULT_SSL_CURRENCY || "BDT",
    success_url: process.env.DEFAULT_SSL_SUCCESS_URL || `${APP_BASE_URL}/api/v1/PaymentSuccess`,
    fail_url: process.env.DEFAULT_SSL_FAIL_URL || `${APP_BASE_URL}/api/v1/PaymentFail`,
    cancel_url: process.env.DEFAULT_SSL_CANCEL_URL || `${APP_BASE_URL}/api/v1/PaymentCancel`,
    ipn_url: process.env.DEFAULT_SSL_IPN_URL || `${APP_BASE_URL}/api/v1/PaymentIPN`,
    init_url: process.env.DEFAULT_SSL_INIT_URL || "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
};

const collectPaymentSettings = async () => {
    const doc = await PaymentSettingModel.findOne();
    const settings = {
        store_id: process.env.SSL_STORE_ID || doc?.store_id || defaultPaymentSettings.store_id,
        store_passwd: process.env.SSL_STORE_PASSWORD || doc?.store_passwd || defaultPaymentSettings.store_passwd,
        currency: process.env.SSL_CURRENCY || doc?.currency || defaultPaymentSettings.currency,
        success_url: process.env.SSL_SUCCESS_URL || doc?.success_url || defaultPaymentSettings.success_url,
        fail_url: process.env.SSL_FAIL_URL || doc?.fail_url || defaultPaymentSettings.fail_url,
        cancel_url: process.env.SSL_CANCEL_URL || doc?.cancel_url || defaultPaymentSettings.cancel_url,
        ipn_url: process.env.SSL_IPN_URL || doc?.ipn_url || defaultPaymentSettings.ipn_url,
        init_url: process.env.SSL_INIT_URL || doc?.init_url || defaultPaymentSettings.init_url
    };

    const missing = Object.entries(settings)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length) {
        return { error: `Payment gateway settings are missing: ${missing.join(', ')}` };
    }

    return { settings };
};

const shouldUseMockGateway = (settings) => {
    if (PAYMENT_GATEWAY_MODE === "mock") return true;
    if (PAYMENT_GATEWAY_MODE === "live" || PAYMENT_GATEWAY_MODE === "sandbox") return false;

    return (
        settings.store_id === defaultPaymentSettings.store_id &&
        settings.store_passwd === defaultPaymentSettings.store_passwd
    );
};

const buildMockGatewayPayload = (tran_id, reason = "auto") => ({
    status: "success",
    data: {
        GatewayPageURL: `${APP_BASE_URL}/api/v1/MockGateway/${tran_id}`,
        isMockGateway: true,
        reason
    },
    message: "Using in-app mock payment gateway."
});

const renderMockGatewayHtml = (tranID, redirectURL, successURL) => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mock Payment Gateway</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #060b29; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #11183f; padding: 32px; border-radius: 16px; box-shadow: 0 20px 45px rgba(7,12,40,0.55); max-width: 460px; text-align: center; }
        h1 { font-size: 1.6rem; margin-bottom: 12px; }
        p { line-height: 1.5; color: #d2d8ff; }
        .pulse { margin: 24px auto; width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(135deg,#5c7cfa,#9775fa); box-shadow: 0 0 0 rgba(92,124,250,0.4); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(92,124,250,0.7);} 70% { transform: scale(1); box-shadow: 0 0 0 25px rgba(92,124,250,0);} 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(92,124,250,0);} }
        .status { font-size: 0.95rem; margin-top: 18px; letter-spacing: 0.08em; text-transform: uppercase; color: #a5b4fc; }
    </style>
</head>
<body>
    <main class="card">
        <div class="pulse"></div>
        <h1>Payment simulated</h1>
        <p>Order #${tranID} has been auto-approved using the mock gateway.</p>
        <p class="status">Finishing up…</p>
    </main>
    <script>
        (async () => {
            try { await fetch('${successURL}', { method: 'POST' }); }
            catch (err) { console.error('Mock gateway confirm failed', err); }
            finally { setTimeout(() => { window.location.href = '${redirectURL}'; }, 1200); }
        })();
    </script>
</body>
</html>`;

const MockGatewayPageService = async (trxID) => {
    try {
        const invoice = await InvoiceModel.findOne({ tran_id: Number(trxID) });
        if (!invoice) {
            return {
                status: "fail",
                html: `<main style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:64px;text-align:center;">
                    <h1 style="color:#11183f;">Invoice not found</h1>
                    <p>We couldn't locate order #${trxID}. Please return to the shop and try again.</p>
                    <a href="${FRONTEND_BASE_URL}" style="display:inline-block;margin-top:24px;padding:12px 20px;background:#5c7cfa;color:#fff;border-radius:8px;text-decoration:none;">Back to store</a>
                </main>`
            };
        }

        const redirectURL = `${FRONTEND_BASE_URL}/orders?payment=mock-success&tran_id=${trxID}`;
        const successURL = `${APP_BASE_URL}/api/v1/PaymentSuccess/${trxID}`;
        return {
            status: "success",
            html: renderMockGatewayHtml(trxID, redirectURL, successURL)
        };
    } catch (err) {
        return {
            status: "fail",
            html: `<p>Mock gateway encountered an error: ${err?.message || 'Unknown error'}.</p>`
        };
    }
};

const CreateInvoiceService = async (req) => {
    try {
        let user_id = new ObjectID(req.headers.user_id);
        let cus_email = req.headers.email;

        const matchStage = { $match: { userID: user_id } };
        const JoinStageProduct = {
            $lookup: {
                from: "products",
                localField: "productID",
                foreignField: "_id",
                as: "product"
            }
        };
        const unwindStage = { $unwind: "$product" };
        const CartProducts = await CartModel.aggregate([matchStage, JoinStageProduct, unwindStage]);

        if (CartProducts.length === 0) {
            return { status: "fail", message: "Your cart is empty. Please add items before checkout." };
        }

        let totalAmount = 0;
        CartProducts.forEach((element) => {
            const price = element['product']['discount'] ? parseFloat(element['product']['discountPrice']) : parseFloat(element['product']['price']);
            totalAmount += parseFloat(element['qty']) * price;
        });

        let vat = totalAmount * 0.05;
        let payable = totalAmount + vat;

        const profileList = await ProfileModel.aggregate([matchStage]);
        if (!profileList.length) {
            return { status: "fail", message: "Please complete your shipping profile before checkout." };
        }
        const profile = profileList[0];

        let cus_details = `Name:${profile['cus_name']}, Email:${cus_email}, Address:${profile['cus_add']}, Phone:${profile['cus_phone']}`;
        let ship_details = `Name:${profile['ship_name']}, City:${profile['ship_city']}, Address:${profile['ship_add']}, Phone:${profile['ship_phone']}`;

        let tran_id = Math.floor(10000000 + Math.random() * 90000000);
        let val_id = 0;
        let delivery_status = "pending";
        let payment_status = "pending";

        let createInvoice = await InvoiceModel.create({
            userID: user_id,
            payable: payable,
            cus_details: cus_details,
            ship_details: ship_details,
            tran_id: tran_id,
            val_id: val_id,
            payment_status: payment_status,
            delivery_status: delivery_status,
            total: totalAmount,
            vat: vat,
        });

        let invoice_id = createInvoice['_id'];
        await Promise.all(
            CartProducts.map((element) =>
                InvoiceProductModel.create({
                    userID: user_id,
                    productID: element['productID'],
                    invoiceID: invoice_id,
                    qty: element['qty'],
                    price: element['product']['discount'] ? element['product']['discountPrice'] : element['product']['price'],
                    color: element['color'],
                    size: element['size']
                })
            )
        );

        await CartModel.deleteMany({ userID: user_id });

        const { settings, error } = await collectPaymentSettings();
        if (error) {
            return { status: "fail", message: error };
        }

        const useMockGateway = shouldUseMockGateway(settings);

        if (useMockGateway) {
            return buildMockGatewayPayload(tran_id, "default-settings");
        }

        const form = new FormData();
        form.append('store_id', settings['store_id']);
        form.append('store_passwd', settings['store_passwd']);
        form.append('total_amount', payable.toString());
        form.append('currency', settings['currency']);
        form.append('tran_id', tran_id);

        form.append('success_url', `${settings['success_url']}/${tran_id}`);
        form.append('fail_url', `${settings['fail_url']}/${tran_id}`);
        form.append('cancel_url', `${settings['cancel_url']}/${tran_id}`);
        form.append('ipn_url', `${settings['ipn_url']}/${tran_id}`);

        form.append('cus_name', profile['cus_name']);
        form.append('cus_email', cus_email);
        form.append('cus_add1', profile['cus_add']);
        form.append('cus_add2', profile['cus_add']);
        form.append('cus_city', profile['cus_city']);
        form.append('cus_state', profile['cus_state']);
        form.append('cus_postcode', profile['cus_postcode']);
        form.append('cus_country', profile['cus_country']);
        form.append('cus_phone', profile['cus_phone']);
        form.append('cus_fax', profile['cus_phone']);

        form.append('shipping_method', "YES");
        form.append('ship_name', profile['ship_name']);
        form.append('ship_add1', profile['ship_add']);
        form.append('ship_add2', profile['ship_add']);
        form.append('ship_city', profile['ship_city']);
        form.append('ship_state', profile['ship_state']);
        form.append('ship_country', profile['ship_country']);
        form.append('ship_postcode', profile['ship_postcode']);

        form.append('product_name', 'According Invoice');
        form.append('product_category', 'According Invoice');
        form.append('product_profile', 'According Invoice');
        form.append('product_amount', 'According Invoice');

        try {
            const sslRes = await axios.post(settings['init_url'], form, {
                headers: form.getHeaders()
            });

            if (sslRes?.data?.GatewayPageURL) {
                return { status: "success", data: sslRes.data };
            }

            if (ALLOW_PAYMENT_FALLBACK) {
                return buildMockGatewayPayload(tran_id, "missing-gateway-url");
            }

            return { status: "fail", message: "Payment gateway did not return a redirect URL." };
        } catch (gatewayError) {
            console.error("SSLCommerz init failed", gatewayError?.response?.data || gatewayError?.message);
            if (ALLOW_PAYMENT_FALLBACK) {
                return buildMockGatewayPayload(tran_id, "gateway-error");
            }
            return { status: "fail", message: gatewayError?.message || "Unable to start checkout." };
        }
    } catch (error) {
        console.error("CreateInvoiceService error", error);
        return { status: "fail", message: error?.message || "Unable to start checkout." };
    }
}




const PaymentSuccessService = async (req)=>{
    try{
        let trxID=req.params.trxID;
        await  InvoiceModel.updateOne({tran_id:trxID},{payment_status:"success"});
        return {status:"success"}
    }catch (e) {
        return {status:"fail", message:"Something Went Wrong"}
    }
}

const PaymentFailService = async (req)=>{
    try{
        let trxID=req.params.trxID;
        await  InvoiceModel.updateOne({tran_id:trxID},{payment_status:"fail"});
        return {status:"fail"}
    }catch (e) {
        return {status:"fail", message:"Something Went Wrong"}
    }
}

const PaymentCancelService = async (req)=>{
    try{
        let trxID=req.params.trxID;
        await  InvoiceModel.updateOne({tran_id:trxID},{payment_status:"cancel"});
        return {status:"cancel"}
    }catch (e) {
        return {status:"fail", message:"Something Went Wrong"}
    }
}





const PaymentIPNService = async (req)=>{
    try{
        let trxID=req.params.trxID;
        let status=req.body['status'];
        await  InvoiceModel.updateOne({tran_id:trxID},{payment_status:status});
        return {status:"success"}
    }catch (e) {
        return {status:"fail", message:"Something Went Wrong"}
    }
}





const InvoiceListService = async (req)=>{
    try{
        let user_id=req.headers.user_id;
        let invoice=await InvoiceModel.find({userID:user_id});
        return {status:"success",data: invoice}
    }catch (e) {
        return {status:"fail", message:"Something Went Wrong"}
    }
}



const InvoiceProductListService = async (req)=>{
   try{

       let user_id=new ObjectID(req.headers.user_id);
       let invoice_id=new ObjectID(req.params.invoice_id);

       let matchStage={$match:{userID:user_id,invoiceID:invoice_id}}
       let JoinStageProduct={$lookup:{from:"products",localField:"productID",foreignField:"_id",as:"product"}}
       let unwindStage={$unwind:"$product"}

       let products=await InvoiceProductModel.aggregate([
           matchStage,
           JoinStageProduct,
           unwindStage
       ])


        return {status:"success",data: products}
    }catch (e) {
        return {status:"fail", message:"Something Went Wrong"}
    }
}




module.exports={
    CreateInvoiceService,
    PaymentFailService,
    PaymentCancelService,
    PaymentIPNService,
    PaymentSuccessService,
    InvoiceListService,
    InvoiceProductListService,
    MockGatewayPageService
}