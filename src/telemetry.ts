import { ApplicationInsights, ICustomProperties, SeverityLevel } from "@microsoft/applicationinsights-web";

const appInsights = new ApplicationInsights({
  config: {
    connectionString:
      "InstrumentationKey=8e4e08a4-361d-402f-ac2d-b6c0c5773935;IngestionEndpoint=https://northeurope-2.in.applicationinsights.azure.com/;LiveEndpoint=https://northeurope.livediagnostics.monitor.azure.com/;ApplicationId=4d69759f-25c2-4fbc-82e6-f918415afea8",
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true,
    disableExceptionTracking: false,
  },
});

appInsights.loadAppInsights();

export function trackError(
  error: Error | unknown | undefined,
  severityLevel: SeverityLevel,
  contextMessage: string,
  customProperties: ICustomProperties | undefined = undefined
) {
  if (error instanceof Error) {
    appInsights.trackException({ exception: error, severityLevel: severityLevel }, { contextMessage, ...(customProperties || {}) });
  } else if (error === undefined) {
    appInsights.trackException({ exception: new Error("undefined error"), severityLevel: severityLevel }, { contextMessage, ...(customProperties || {}) });
  } else {
    appInsights.trackException(
      { exception: new Error(`unknown error: ${JSON.stringify(error || "")}`), severityLevel: severityLevel },
      { contextMessage, ...(customProperties || {}) }
    );
  }
}

export default appInsights;
