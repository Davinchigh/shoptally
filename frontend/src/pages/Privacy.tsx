import { Logo } from "../ui";

export default function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <div className="auth">
      <section className="hero">
        <Logo />
        <h1>How ShopTally uses your data</h1>
        <p>Last updated 9 November 2026</p>
      </section>
      <article className="prose">
        <p>ShopTally is a portfolio project built by Benedict Frimpong Boateng. It helps a small shop record sales, track stock and check MoMo payments. This page says what it keeps and why.</p>

        <h2>What is stored</h2>
        <ul>
          <li><b>Your account:</b> shop name, email address, and your password as a one-way bcrypt hash. The password itself is never stored.</li>
          <li><b>Your shop:</b> the products, prices and stock levels you enter, and each sale: items, amount, cash or MoMo, the time, and the MoMo transaction ID or customer phone number if you type one in.</li>
        </ul>

        <h2>What is not stored</h2>
        <ul>
          <li><b>MoMo statements:</b> a statement you upload is read once to match payments and then thrown away. Nothing from it is saved.</li>
          <li><b>Cookies and tracking:</b> ShopTally sets no cookies and uses no analytics or advertising trackers. Your sign-in token is kept in your browser's local storage so you stay signed in; signing out deletes it. Because nothing optional is stored, there is no cookie banner.</li>
        </ul>

        <h2>Why it is kept</h2>
        <p>Only to run the app for you: show your sales and stock, and match payments. It is never sold or shared for marketing.</p>

        <h2>The demo shop</h2>
        <p>The demo shop is shared and its products and sales are made up. Please don't type real customer names, phone numbers or payment details into it.</p>

        <h2>Your rights</h2>
        <p>Under Ghana's Data Protection Act, 2012 (Act 843) you can ask what is held about you, ask for it to be corrected, or ask for your shop and everything in it to be deleted. Contact the developer through the details on <a href="https://benedict-frimpong-boateng.vercel.app">benedict-frimpong-boateng.vercel.app</a>. You can also complain to Ghana's Data Protection Commission at <a href="https://dataprotection.org.gh">dataprotection.org.gh</a>.</p>

        <button className="btn dark" onClick={onBack}>Back to ShopTally</button>
      </article>
    </div>
  );
}
