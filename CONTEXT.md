# OVbAT Training

OVbAT guides a person through connecting an OVbAT training device, completing a fixed-count training session, and reviewing saved results.

## Language

**Device**:
The physical OVbAT training unit that detects balls and owns the authoritative training state.
_Avoid_: Peripheral, sensor, machine

**Training Session**:
One intentional attempt to complete the fixed training target, from the device accepting the start request through completion or recovery.
_Avoid_: Workout, run, attempt

**Ready**:
A Device is connected, prepared, and synchronized well enough to accept a new Training Session.
_Avoid_: Connected, Online

**Active**:
A Training Session accepted by the Device and currently awaiting completion.
_Avoid_: Running, In progress

**Armed**:
A Device state in which a Training Session start request has been accepted, but the session timer is waiting for the operator's physical start action.
_Avoid_: Ready, Active

**Device Start Button**:
The physical control used to move an Armed Device into Active and begin the Training Session timer.
_Avoid_: Start Training button

**Ball Detection**:
A valid physical event recognized by the Device and counted toward the Training Session target.
_Avoid_: Hit, Score

**Recovery**:
The user-facing state entered when communication with an Active Device is interrupted while the Training Session may still continue on the Device.
_Avoid_: Failed, Disconnected session

**Result**:
The Device-authoritative outcome of a completed Training Session, including its final count and duration.
_Avoid_: Score, Summary

**History**:
The user's locally saved collection of Results, ordered from newest to oldest.
_Avoid_: Archive, Log
