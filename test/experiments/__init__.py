# -*- coding: utf-8 -*-
"""실험 암 패키지 — 운영 엔진과 격리된 A/B 평가."""
from . import arm_a_proto, arm_b, arm_control, phase_config

ARMS = {
    arm_control.ARM_ID: arm_control,
    arm_a_proto.ARM_ID: arm_a_proto,
    arm_b.ARM_ID: arm_b,
}

__all__ = ["ARMS", "arm_control", "arm_a_proto", "arm_b", "phase_config"]
