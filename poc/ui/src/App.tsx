import { ThemeProvider } from "./theme/ThemeProvider";
import { PipelineProvider, usePipeline } from "./state/PipelineProvider";
import { Toast } from "./components/ui/Toast";
import { PrototypeControls } from "./components/PrototypeControls";
import { appConfig, isScreenEnabled } from "./config/appConfig";
import { tenant } from "./data/fixtures/tenant";
import type { ScreenKey } from "./data/types";

import { SignInScreen } from "./screens/SignInScreen";
import { ContextDropScreen } from "./screens/ContextDropScreen";
import { GuidedIntakeScreen } from "./screens/GuidedIntakeScreen";
import { VenueMapScreen } from "./screens/VenueMapScreen";
import { GateAScreen } from "./screens/GateAScreen";
import { DiscoveryScreen } from "./screens/DiscoveryScreen";
import { GateBScreen } from "./screens/GateBScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { SourcesScreen } from "./screens/SourcesScreen";
import { IntakeBankScreen } from "./screens/IntakeBankScreen";
import { ContextScreen } from "./screens/ContextScreen";
import { ProspectTrackingScreen } from "./screens/ProspectTrackingScreen";
import { EmailScreen } from "./screens/EmailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const screens: Record<ScreenKey, () => JSX.Element> = {
  signin: SignInScreen,
  context: ContextDropScreen,
  intake: GuidedIntakeScreen,
  venues: VenueMapScreen,
  gateA: GateAScreen,
  loading: DiscoveryScreen,
  gateB: GateBScreen,
  dashboard: DashboardScreen,
  sources: SourcesScreen,
  profile: IntakeBankScreen,
  cag: ContextScreen,
  outreach: ProspectTrackingScreen,
  email: EmailScreen,
  settings: SettingsScreen,
};

function Router() {
  const { state } = usePipeline();
  // Disabled screens (e.g. onboarding in the PoC build) fall back to the landing screen.
  const screen: ScreenKey = isScreenEnabled(state.screen)
    ? state.screen
    : appConfig.postLoginScreen;
  const Screen = screens[screen] ?? SignInScreen;
  return <Screen />;
}

function Chrome() {
  const { state } = usePipeline();
  return (
    <>
      <Router />
      <Toast message={state.toast} />
      {appConfig.showThemeControls && <PrototypeControls />}
    </>
  );
}

export function App() {
  return (
    <ThemeProvider defaultTheme={tenant.defaultTheme}>
      <PipelineProvider>
        <Chrome />
      </PipelineProvider>
    </ThemeProvider>
  );
}
