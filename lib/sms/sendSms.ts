export async function sendSms({
  phone,
  message,
}: {
  phone: string;
  message: string;
}) {
  try {
    const sender = 4;

    const formattedPhone = phone
      .replace(/\s/g, "")
      .replace(/^0/, "40");

    console.log(
      "SMS PHONE:",
      formattedPhone
    );

    const url =
      `https://app.smso.ro/api/v1/send` +
      `?sender=${sender}` +
      `&to=${encodeURIComponent(formattedPhone)}` +
      `&body=${encodeURIComponent(message)}` +
      `&apiKey=${process.env.SMSO_API_KEY}`;

    const res = await fetch(url);

    const data = await res.json();

    console.log(
      "SMS RESPONSE:",
      data
    );

    return data;

  } catch (e) {

    console.error(
      "SMS ERROR:",
      e
    );

    return null;
  }
}