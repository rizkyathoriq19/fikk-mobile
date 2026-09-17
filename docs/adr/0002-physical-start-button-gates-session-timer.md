# Physical start button gates the session timer

The mobile app sends the session start intent and session ID, then the Device enters **Armed**. The Device Start Button is the only action that transitions the Device to **Active** and starts its authoritative timer; IR Ball Detection events are counted only while Active.

This keeps mobile notes and the app-generated session ID correlated with the Device-owned Result while satisfying the physical-start requirement. The rejected alternative was allowing the Device to create sessions independently from a button press, which would require a larger protocol change and make mobile-side session correlation less reliable.
