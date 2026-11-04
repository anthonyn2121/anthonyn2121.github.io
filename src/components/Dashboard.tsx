import { useState } from "react";
import { Briefing } from "./Briefing";
import { ConsolePanel } from "./panels/ConsolePanel";
import { FlightPlanPanel } from "./panels/FlightPlanPanel";
import { OperatorPanel } from "./panels/OperatorPanel";
import { PayloadPanel } from "./panels/PayloadPanel";

export function Dashboard() {
  const [payloadIndex, setPayloadIndex] = useState(0);
  const [replay, setReplay] = useState(0);

  return (
    <div className="dashboard" id="top">
      <Briefing />
      <div className="dashboard__grid">
        <OperatorPanel />
        <FlightPlanPanel replayKey={replay} />
        <PayloadPanel index={payloadIndex} setIndex={setPayloadIndex} />
        <ConsolePanel onOpenProject={setPayloadIndex} onReplayFlight={() => setReplay((r) => r + 1)} />
      </div>
    </div>
  );
}
