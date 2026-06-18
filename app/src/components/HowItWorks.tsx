// Collapsible, plain-language explanation of the TCO model — shown in-app
// (no external/local file links). Kept simple on purpose.
export function HowItWorks() {
  return (
    <details className="howworks">
      <summary>
        <span>How these numbers are calculated</span>
        <span className="chev">›</span>
      </summary>
      <div className="howworks-body">
        <p>
          <strong>Total cost of ownership</strong> is what a car really costs you from the day you buy it to the day you
          sell it — not just the sticker price. Over your holding period we add up seven things:
        </p>
        <ul>
          <li>
            <strong>Depreciation</strong> — the value the car loses while you own it (this is how the purchase price is
            counted — see the note below). We estimate the resale from a <strong>value-retention curve by age</strong>{' '}
            (based on the Toyota RAV4 curve): a car drops fast in its early years, then levels off. So the resale depends
            on the <strong>model year</strong> (how old it is now) and your <strong>holding period</strong> (how old
            it'll be when you sell) — type your own resale figure into a car to override it.
          </li>
          <li>
            <strong>Financing</strong> — interest you pay on a loan ($0 if you pay cash).
          </li>
          <li>
            <strong>Fuel / energy</strong> — gas or electricity for the miles you drive.
          </li>
          <li>
            <strong>Insurance</strong> — your yearly premium.
          </li>
          <li>
            <strong>Maintenance</strong> — routine service and tires.
          </li>
          <li>
            <strong>Repairs</strong> — out-of-warranty fixes; counted as $0 while the car is still under warranty.
          </li>
          <li>
            <strong>Taxes &amp; fees</strong> — sales tax plus registration.
          </li>
        </ul>
        <p className="howworks-note">
          <strong>Does this include the purchase price?</strong> Yes. You pay the full price up front, but you get part
          of it back when you sell. So we count the part you <em>don't</em> get back —{' '}
          <strong>depreciation = price − resale value</strong> — plus sales tax and any loan interest on the price.
          Counting the whole price <em>and</em> the resale separately would double-count it. The cost-over-time chart
          starts at the full purchase price and dips at the end when you recover the resale value.
        </p>
        <p className="howworks-caveat">
          ⚠️ These are rough estimates from typical values. Real depreciation, incentives, insurance, and APR vary a lot —
          verify with live quotes before making a decision.
        </p>
      </div>
    </details>
  );
}
