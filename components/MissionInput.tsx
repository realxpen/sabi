"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CANONICAL_REQUEST =
  "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.";

export function MissionInput() {
  const router = useRouter();
  const [request, setRequest] = useState(CANONICAL_REQUEST);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = request.trim();
    if (!trimmed) {
      return;
    }

    router.push(
      `/mission/demo?request=${encodeURIComponent(trimmed)}`
    );
  }

  return (
    <form className="missionForm" onSubmit={handleSubmit}>
      <label htmlFor="mission-request">Describe your mission</label>
      <textarea
        id="mission-request"
        value={request}
        onChange={(event) => setRequest(event.target.value)}
        rows={5}
        placeholder="Tell SABI what you need, your budget, location, and deadline."
      />
      <button type="submit">Create mission</button>
    </form>
  );
}
