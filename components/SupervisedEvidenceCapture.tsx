"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SupervisedEvidenceCaptureProps = {
  missionId: string;
  communicationId: string;
  providerName: string;
};

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function SupervisedEvidenceCapture({
  missionId,
  communicationId,
  providerName
}: SupervisedEvidenceCaptureProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [operatorToken, setOperatorToken] = useState("");
  const [available, setAvailable] = useState("true");
  const [price, setPrice] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [total, setTotal] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const remembered = window.sessionStorage.getItem("sabi-operator-token");
    if (remembered) setOperatorToken(remembered);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const token = operatorToken.trim();
    if (!token) {
      setMessage("Enter the supervised operator token first.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        available: available === "true",
        price: optionalNumber(price),
        deliveryFee: optionalNumber(deliveryFee),
        total: optionalNumber(total),
        deliveryDate: deliveryDate.trim() || undefined,
        notes: notes.trim() || undefined
      };

      const response = await fetch(
        `/api/missions/${encodeURIComponent(missionId)}/communications/${encodeURIComponent(communicationId)}/evidence`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        missionStatus?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem("sabi-operator-token");
        }
        throw new Error(result.error ?? "Evidence could not be saved.");
      }

      window.sessionStorage.setItem("sabi-operator-token", token);
      setMessage(
        result.missionStatus === "AWAITING_APPROVAL"
          ? "Evidence saved. SABI compared the settled responses and prepared human approval."
          : "Evidence saved as a source-traceable Quote."
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Evidence could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="evidencePrompt">
        <div>
          <strong>Needs factual evidence</strong>
          <span>
            The call completed, but SABI will not guess price, availability or
            delivery from the transcript.
          </span>
        </div>
        <button
          type="button"
          className="secondaryAction"
          onClick={() => setOpen(true)}
        >
          Add provider facts
        </button>
        {message ? <p className="evidenceMessage">{message}</p> : null}
      </div>
    );
  }

  return (
    <form className="evidenceForm" onSubmit={submit}>
      <div className="evidenceFormHeader">
        <div>
          <strong>Record only what {providerName} actually confirmed</strong>
          <span>Unknown values can stay blank.</span>
        </div>
        <button
          type="button"
          className="textAction"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      <label>
        Operator token
        <input
          type="password"
          value={operatorToken}
          onChange={(event) => setOperatorToken(event.target.value)}
          autoComplete="off"
          placeholder="SABI_OPERATOR_TOKEN"
          required
        />
      </label>

      <label>
        Available
        <select
          value={available}
          onChange={(event) => setAvailable(event.target.value)}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>

      <div className="evidenceFormGrid">
        <label>
          Price (₦)
          <input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="60000"
          />
        </label>
        <label>
          Delivery fee (₦)
          <input
            inputMode="decimal"
            value={deliveryFee}
            onChange={(event) => setDeliveryFee(event.target.value)}
            placeholder="3000"
          />
        </label>
        <label>
          Total (₦)
          <input
            inputMode="decimal"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="63000"
          />
        </label>
        <label>
          Delivery timing
          <input
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            placeholder="tomorrow"
          />
        </label>
      </div>

      <label>
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Only factual details the provider confirmed."
          rows={3}
        />
      </label>

      <button className="primaryAction" type="submit" disabled={submitting}>
        {submitting ? "Saving evidence…" : "Save factual evidence"}
      </button>

      <p className="safetyNote">
        This records evidence only. It does not purchase, book, pay or approve
        anything.
      </p>
      {message ? <p className="evidenceMessage">{message}</p> : null}
    </form>
  );
}
