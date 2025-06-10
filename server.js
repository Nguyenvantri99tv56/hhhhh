// ==== server.js ====
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const PayOS = require("@payos/node");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const payOS = new PayOS(
  process.env.CLIENT_ID,
  process.env.API_KEY,
  process.env.CHECKSUM_KEY
);

const products = {
  1: {
    name: "Giáo trình tự học tiếng Anh giao tiếp",
    price: 50000,
    downloadLink: "https://chilldanang.com/files/giaotrinh-anh.pdf",
  },
  2: {
    name: "Bộ đề luyện thi THPT Quốc Gia môn Toán",
    price: 80000,
    downloadLink: "https://chilldanang.com/files/bo-de-toan.pdf",
  },
};

const ORDER_DB_PATH = path.join(__dirname, "webhook.json");
function readOrders() {
  if (!fs.existsSync(ORDER_DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(ORDER_DB_PATH, "utf-8"));
}
function saveOrder(orderCode, data) {
  const db = readOrders();
  db[orderCode] = data;
  fs.writeFileSync(ORDER_DB_PATH, JSON.stringify(db, null, 2));
}

app.post("/create-payment-link", async (req, res) => {
  const { name, phone, email, productId } = req.body;
  const product = products[productId];
  if (!product) return res.status(400).json({ error: "Sản phẩm không tồn tại" });

  const orderCode = Number(Date.now().toString().slice(-6));
  const returnUrl = "https://chilldanang.com/success.html";
  const cancelUrl = "https://chilldanang.com/thanhtoan.html";

  try {
    const paymentLink = await payOS.createPaymentLink({
      orderCode,
      amount: product.price,
      description: `Mua: ${product.name}`,
      returnUrl,
      cancelUrl,
      buyerName: name,
      buyerEmail: email,
      buyerPhone: phone,
      items: [
        {
          name: product.name,
          quantity: 1,
          price: product.price,
        },
      ],
    });

    saveOrder(orderCode, {
      orderCode,
      paid: false,
      downloadLink: product.downloadLink,
    });

    res.json({
      checkoutUrl: paymentLink.checkoutUrl,
      orderCode,
    });
  } catch (err) {
    console.error("Lỗi tạo link:", err);
    res.status(500).json({ error: "Không tạo được link thanh toán" });
  }
});

app.post("/webhook", (req, res) => {
  const { orderCode, status } = req.body;
  if (status === "PAID") {
    const db = readOrders();
    if (db[orderCode]) {
      db[orderCode].paid = true;
      saveOrder(orderCode, db[orderCode]);
      console.log(`\u2714\ufe0f Xác nhận thanh toán: ${orderCode}`);
    }
  }
  res.json({ received: true });
});

app.get("/order-status/:orderCode", (req, res) => {
  const db = readOrders();
  const order = db[req.params.orderCode];
  if (!order) return res.json({ paid: false });
  res.json({ paid: order.paid, downloadLink: order.downloadLink });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\u2714\ufe0f Server đang chạy trên cổng ${PORT}`);
});