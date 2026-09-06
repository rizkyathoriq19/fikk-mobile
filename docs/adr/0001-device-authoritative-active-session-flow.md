# Device-authoritative active-session flow

The app uses a dedicated Active Training screen and treats the Device as the source of truth for session progress and the final Result. This separates connection/recovery concerns from the Home dashboard and prevents phone-side timing or navigation state from being mistaken for authoritative training data; the rejected alternative was keeping progress inline on Home and deriving completion from the phone.
