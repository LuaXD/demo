"use client";
import { useEffect, useState } from "react";
import {
  PollarClient,
  rampReplacementQuote,
  mergeRampSnapshot,
  type RampQuote,
  type RampSnapshot,
} from "@pollar/core";
import { RampWorkflow } from "@pollar/react";
const fixtureUrl = "http://localhost:3092";
const sessionKey = "pollar-stereum-fixture";
export default function StereumFixturePage() {
  const [client, setClient] = useState<PollarClient | null>(null);
  const [direction, setDirection] = useState<"onramp" | "offramp">("onramp");
  const [quote, setQuote] = useState<RampQuote | null>(null);
  const [snapshot, setSnapshot] = useState<RampSnapshot | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [funded, setFunded] = useState(false);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    if (window.location.hostname !== "localhost") {
      setMessage("This fixture demo runs on localhost.");
      setRestoring(false);
      return;
    }
    const sdk = new PollarClient({
      apiKey: "pk_fixture_stereum",
      baseUrl: fixtureUrl,
    });
    sdk.registerRampSigningHandler(
      "STELLAR",
      "fixture-json",
      async (action) => "signed:" + action.payload.value,
    );
    setClient(sdk);
    let active = true;
    const saved = sessionStorage.getItem(sessionKey);
    if (saved) {
      try {
        const reference = JSON.parse(saved) as {
          txId: string;
          direction: "onramp" | "offramp";
          funded: boolean;
        };
        if (
          !reference.txId ||
          !["onramp", "offramp"].includes(reference.direction)
        )
          throw new Error("Invalid fixture reference");
        void sdk
          .getRampTransaction(reference.txId)
          .then((next) => {
            if (!active) return;
            setDirection(reference.direction);
            setFunded(reference.funded);
            setSnapshot(next);
          })
          .catch(() => {
            if (active) sessionStorage.removeItem(sessionKey);
          })
          .finally(() => {
            if (active) setRestoring(false);
          });
      } catch {
        sessionStorage.removeItem(sessionKey);
        setRestoring(false);
      }
    } else setRestoring(false);
    return () => {
      active = false;
      sdk.destroy();
    };
  }, []);
  useEffect(() => {
    if (restoring) return;
    if (snapshot)
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ txId: snapshot.txId, direction, funded }),
      );
    else sessionStorage.removeItem(sessionKey);
  }, [snapshot?.txId, direction, funded, restoring]);
  useEffect(() => {
    if (
      !client ||
      !snapshot ||
      ["completed", "failed", "refunded"].includes(
        snapshot.lifecycleState ?? "",
      )
    )
      return;
    const id = snapshot.txId;
    let active = true;
    const timer = setInterval(
      () =>
        void client
          .getRampTransaction(id)
          .then((next) => {
            if (active)
              setSnapshot((previous) => mergeRampSnapshot(previous, next));
          })
          .catch((error) => {
            if (active) setMessage(error.message);
          }),
      1000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client, snapshot?.txId, snapshot?.lifecycleState]);
  function changed(next: RampQuote) {
    setQuote(next);
    setSnapshot(null);
    setMessage(
      "The quote changed. Review the exact totals and click Accept quote again.",
    );
  }
  async function getQuote() {
    if (!client) return;
    setBusy(true);
    setMessage("");
    setSnapshot(null);
    setFunded(false);
    try {
      const result = await client.getRampsQuote({
        country: "BO",
        currency: "BOB",
        direction,
        amount: 100,
        amountExact: "100",
        chain: "STELLAR",
      });
      const next = result.quotes[0];
      if (!next)
        throw new Error(
          "No fixture quote is available. Start the fixture API on port 3092.",
        );
      setQuote(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Quote failed");
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    if (!client || !quote) return;
    setBusy(true);
    setMessage("");
    try {
      const body = {
        quoteId: quote.quoteId,
        amount: quote.fiatAmount ?? 100,
        amountExact: quote.terms!.fiatAmount,
        country: "BO",
        currency: "BOB",
        fields,
      };
      const next =
        direction === "onramp"
          ? await client.createOnRamp(body)
          : await client.createOffRamp(body);
      setSnapshot(next);
      setQuote(null);
    } catch (error) {
      const replacement = rampReplacementQuote(error);
      if (replacement) changed(replacement);
      else
        setMessage(
          error instanceof Error ? error.message : "Could not start transfer",
        );
    } finally {
      setBusy(false);
    }
  }
  async function fund() {
    if (!snapshot) return;
    setBusy(true);
    try {
      const result = await fetch(
        fixtureUrl + "/fixture/fund/" + encodeURIComponent(snapshot.txId),
        { method: "POST" },
      );
      if (!result.ok) throw new Error("Fixture payment failed");
      setFunded(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Fixture payment failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Stereum adapter fixture demo</h1>
      <p>
        These wallets, payments and receipts are simulated. No funds move. The
        local Pollar library calls the real backend ramp controllers and saved
        workflow.
      </p>
      <div className="flex gap-3 items-center">
        <label>
          Direction{" "}
          <select
            className="border rounded p-2"
            value={direction}
            disabled={busy || !!snapshot}
            onChange={(e) => {
              setDirection(e.target.value as typeof direction);
              setQuote(null);
              setFields({});
            }}
          >
            <option value="onramp">Deposit: 100 BOB → Stellar USDC</option>
            <option value="offramp">
              Withdrawal: Stellar USDC → BOB bank payout
            </option>
          </select>
        </label>
        <button
          className="border rounded p-2"
          disabled={!client || busy || restoring}
          onClick={() => void getQuote()}
        >
          Get fixture quote
        </button>
      </div>
      {quote && (
        <section
          className="space-y-3 border rounded p-4"
          aria-label="Quote review"
        >
          <h2 className="font-bold">Review exact totals</h2>
          <p>
            {quote.terms?.fiatAmount} {quote.terms?.fiatCurrency} ·{" "}
            {quote.terms?.cryptoAmount} {quote.terms?.assetCode}
          </p>
          <p>
            Public expiry: {quote.expiresAt}. Provider expiry:{" "}
            {quote.providerExpiresAt}.
          </p>
          {quote.requiredFields.map((field) => (
            <label className="block" key={field.key}>
              {field.label}{" "}
              {field.type === "select" ? (
                <select
                  className="border rounded p-2"
                  value={fields[field.key] ?? ""}
                  onChange={(e) =>
                    setFields((previous) => ({
                      ...previous,
                      [field.key]: e.target.value,
                    }))
                  }
                >
                  <option value="">Choose</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="border rounded p-2"
                  value={fields[field.key] ?? ""}
                  onChange={(e) =>
                    setFields((previous) => ({
                      ...previous,
                      [field.key]: e.target.value,
                    }))
                  }
                />
              )}
            </label>
          ))}
          <button
            className="border rounded p-2"
            disabled={
              busy ||
              quote.requiredFields.some(
                (field) => !field.optional && !fields[field.key]?.trim(),
              )
            }
            onClick={() => void accept()}
          >
            Accept quote
          </button>
          <button
            className="border rounded p-2 ml-3"
            disabled={busy}
            onClick={() =>
              void fetch(fixtureUrl + "/fixture/rate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rate: "11" }),
              }).then(() =>
                setMessage(
                  "Fixture rate changed. Click Accept quote to test replacement-quote review.",
                ),
              )
            }
          >
            Simulate changed quote
          </button>
        </section>
      )}
      {client && snapshot && (
        <section className="border rounded p-4 space-y-4">
          <RampWorkflow
            client={client}
            snapshot={snapshot}
            onChange={(next) =>
              setSnapshot((previous) => mergeRampSnapshot(previous, next))
            }
            onQuoteChanged={changed}
          />
          {direction === "onramp" &&
            !funded &&
            snapshot.lifecycleState !== "completed" && (
              <button
                className="border rounded p-2"
                disabled={busy}
                onClick={() => void fund()}
              >
                Simulate exact BOB payment
              </button>
            )}
          <p>
            State: {snapshot.lifecycleState}. Version:{" "}
            {snapshot.transactionVersion}. The background worker advances the
            saved bridge plan.
          </p>
          {snapshot.lifecycleState === "completed" && (
            <button
              className="border rounded p-2"
              onClick={() => {
                setSnapshot(null);
                setFunded(false);
                void fetch(fixtureUrl + "/fixture/rate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rate: "10" }),
                });
              }}
            >
              Test another direction
            </button>
          )}
        </section>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
