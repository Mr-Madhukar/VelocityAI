import Razorpay from "razorpay";

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay env vars are not configured");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}
