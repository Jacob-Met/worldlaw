"""Replay the registered eight-pulse causal obstruction from its original physics."""
from pathlib import Path
from runpy import run_path

kernel=run_path(str(Path(__file__).with_name('position_drift_causal_obstruction.py')))
Receiver=kernel['EightPulseReceiver']

if __name__=='__main__':
    kernel['run_cli'](Receiver)
