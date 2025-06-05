const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const generateInvoice = async (booking, listing, guest) => {
  return new Promise((resolve, reject) => {
    const invoiceDir = path.join(__dirname, "../invoices");
    if (!fs.existsSync(invoiceDir))
      fs.mkdirSync(invoiceDir, { recursive: true });

    const filePath = path.join(invoiceDir, `invoice-${booking._id}.pdf`);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ✅ Colors
    const green = "#006a4e";
    const red = "#f42a41";

    // ✅ Add Logo (check absolute path)
    const logoPath = path.join(__dirname, "../assets/banglabnb-logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    }

    // ✅ Header
    doc
      .fillColor(green)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("BanglaBnB Invoice", 200, 50, { align: "right" });

    doc
      .moveDown()
      .fontSize(14)
      .fillColor("black")
      .text("Booking Confirmation", { align: "right" });

    doc
      .moveTo(50, doc.y + 10)
      .lineTo(550, doc.y + 10)
      .strokeColor(red)
      .stroke();

    // ✅ Booking Info
    doc
      .moveDown()
      .fontSize(12)
      .fillColor("black")
      .text(`📄 Booking ID: ${booking._id}`)
      .text(`👤 Guest: ${guest.name} (${guest.email})`)
      .text(`🏠 Listing: ${listing.title}`)
      .text(`📍 Location: ${listing.location?.address}`)
      .text(
        `📅 Dates: ${new Date(
          booking.dateFrom
        ).toLocaleDateString()} → ${new Date(
          booking.dateTo
        ).toLocaleDateString()}`
      );

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ddd").stroke();

    // ✅ Pricing Summary
    const nights =
      (new Date(booking.dateTo) - new Date(booking.dateFrom)) /
      (1000 * 60 * 60 * 24);
    const baseRate = listing.price;
    const serviceFee = 100;
    const total = baseRate * nights + serviceFee;

    const formatCurrency = (v) => `৳${v.toFixed(2)}`;

    doc
      .moveDown()
      .fontSize(13)
      .fillColor("black")
      .text("💵 Price Breakdown", { underline: true });

    doc
      .moveDown(0.5)
      .fontSize(12)
      .text(`Nightly Rate (৳${baseRate} x ${nights} nights):`, 50)
      .text(formatCurrency(baseRate * nights), 0, doc.y, { align: "right" })
      .text(`Service Fee:`, 50)
      .text(formatCurrency(serviceFee), 0, doc.y, { align: "right" })
      .font("Helvetica-Bold")
      .text("Total:", 50, doc.y + 5)
      .text(formatCurrency(total), 0, doc.y + 5, { align: "right" })
      .font("Helvetica");

    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor("gray")
      .text("📌 This invoice was generated automatically by BanglaBnB", {
        align: "center",
      });

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
};

module.exports = generateInvoice;
