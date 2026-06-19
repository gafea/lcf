import { RoutePlanner } from "./route-planner";

export default function Home() {
  return <RoutePlanner apiDomain={process.env.API_DOMAIN ?? ""} />;
}
