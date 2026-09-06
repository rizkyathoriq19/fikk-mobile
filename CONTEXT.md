# Fikk Training

Fikk Mobile guides a person through connecting a Fikk training device, completing a fixed-count training session, and reviewing saved results.

## Language

**Device**:
The physical Fikk training unit that detects balls and owns the authoritative training state.
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

**Recovery**:
The user-facing state entered when communication with an Active Device is interrupted while the Training Session may still continue on the Device.
_Avoid_: Failed, Disconnected session

**Result**:
The Device-authoritative outcome of a completed Training Session, including its final count and duration.
_Avoid_: Score, Summary

**History**:
The user's locally saved collection of Results, ordered from newest to oldest.
_Avoid_: Archive, Log
