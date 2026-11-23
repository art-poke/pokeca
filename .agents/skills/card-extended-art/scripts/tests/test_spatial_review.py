"""Regression: matching every card edge cannot approve a distorted outer scene."""
import runpy
import unittest
from pathlib import Path

verify = runpy.run_path(str(Path(__file__).resolve().parents[1] / "check-review.py"))["verify"]


class SpatialReviewTest(unittest.TestCase):
    def setUp(self):
        sides = ("left", "right", "top", "bottom")
        self.analysis = {
            "edges": {side: [{"id": side}] for side in sides},
            "spatial_constraints": [
                {"id": "door", "source_evidence": "Straight free edge", "target": "One plane across pockets 5 and 6"}
            ],
        }
        self.output = {
            "format": "sleeve", "disposition": "final",
            "overall": {"status": "pass", "observed": "Viewed the full print"},
            "checks": [{"anchor": side, "status": "pass", "observed": "Seam joins"} for side in sides],
            "spatial_checks": [
                {"constraint": "door", "region": "6", "status": "pass", "observed": "Free edge remains straight"}
            ],
        }

    def test_complete_scene_can_pass(self):
        verify(self.analysis, [self.output], {"sleeve"}, require_final=True)

    def test_distortion_or_uncertainty_blocks_final_even_if_all_seams_pass(self):
        row = self.output["spatial_checks"][0]
        row.update(observed="Rail kinks beyond the seam", action="Reconstruct the panel")
        for status in ("repair", "unverified"):
            with self.subTest(status=status):
                row["status"] = status
                with self.assertRaises(ValueError):
                    verify(self.analysis, [self.output], {"sleeve"}, require_final=True)

    def test_missing_spatial_evidence_blocks_final(self):
        del self.output["spatial_checks"]
        with self.assertRaises(ValueError):
            verify(self.analysis, [self.output], {"sleeve"}, require_final=True)
        del self.analysis["spatial_constraints"]
        with self.assertRaises(ValueError):
            verify(self.analysis, [self.output], {"sleeve"}, require_final=True)
        self.output["disposition"] = "draft"
        verify(self.analysis, [self.output], {"sleeve"})

    def test_local_request_stays_partial(self):
        self.output["disposition"] = "partial"
        self.output["checks"] = self.output["checks"][:1]
        del self.output["spatial_checks"]
        verify(self.analysis, [self.output], {"sleeve"}, selected_anchors=["left"])
