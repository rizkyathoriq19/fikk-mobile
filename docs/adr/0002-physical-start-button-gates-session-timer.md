# Physical start button gates the session timer

The Device supports two start paths. In **Android + ESP** mode, the mobile app sends the session start intent and session ID, the Device enters **Armed**, and the physical Device Start Button transitions it to **Active**. In **ESP-only** mode, pressing the physical button from **Ready** creates a local session and transitions directly to **Active**. In both modes, the timer starts only on the physical start action and IR Ball Detection events are counted only while Active.

Android + ESP preserves the app-generated session ID for mobile Save/Discard correlation. ESP-only keeps the completed result on the LCD and accepts the next physical button press as a new local session without requiring Android acknowledgement.
