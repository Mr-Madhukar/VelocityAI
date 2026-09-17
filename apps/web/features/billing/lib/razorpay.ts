import Razorpay from "razorpay";

let razorpay: Razorpay | null = null;

export function getRazorpayInstance() {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error("Razorpay env vars are not configured");
    }

    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpay;
}
