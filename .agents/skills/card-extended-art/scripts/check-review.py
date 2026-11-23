"""Check recorded visual review coverage for every requested output."""
import argparse
import hashlib
import json
from pathlib import Path

FORMATS = {
    "9pocket": {"sleeve", "toploader"},
    "sleeve": {"sleeve"},
    "toploader": {"toploader"},
    "psa": {"psa"},
    "brg": {"brg"},
}


def unique(values, label):
    result = set(values)
    if len(result) != len(values) or not all(isinstance(v, str) and v.strip() for v in values):
        raise ValueError(f"{label} ID가 비어 있거나 중복입니다")
    return result


def check_observation(row, require_action):
    status = row["status"]
    if status not in {"pass", "repair", "unverified"} or not row["observed"].strip():
        raise ValueError("관찰 내용과 판정을 기록하세요.")
    if require_action and status != "pass" and not row.get("action", "").strip():
        raise ValueError("미해결 항목에 다음 작업의 수정 또는 재확인 지시가 필요합니다.")


def verify(analysis, reviews, expected_outputs, selected_anchors=None, require_final=False):
    edges = analysis["edges"]
    if set(edges) != {"left", "right", "top", "bottom"} or not all(edges.values()):
        raise ValueError("분석에서 네 변의 연결 요소 또는 해당 변의 배경을 기록해야 합니다")
    anchors = unique([row["id"] for rows in edges.values() for row in rows], "경계")
    constraints = analysis.get("spatial_constraints", [])
    if require_final and not constraints:
        raise ValueError("최종 판정에는 원본의 공간·비례 분석이 필요합니다.")
    spatial_ids = unique([item["id"] for item in constraints], "공간 기준")
    for item in constraints:
        if not item["source_evidence"].strip() or not item["target"].strip():
            raise ValueError(f'{item["id"]}의 원본 근거와 출력에서 확인할 관계가 필요합니다.')
    if selected_anchors:
        requested = unique(selected_anchors, "요청 경계")
        if not requested <= anchors:
            raise ValueError("부분 검수 대상이 원본 분석의 경계 ID와 다릅니다.")
        anchors = requested
    if unique([output["format"] for output in reviews], "규격") != expected_outputs:
        raise ValueError("검수한 인쇄 규격이 요청과 다릅니다")
    for output in reviews:
        checks = output["checks"]
        if unique([row["anchor"] for row in checks], "검수") != anchors:
            raise ValueError(f'{output["format"]} 원본 경계 ID와 검수 ID가 다릅니다')
        # Earlier review files contain edge checks only.
        observations = list(checks)
        if not selected_anchors and (spatial_ids or "spatial_checks" in output):
            spatial = output.get("spatial_checks", [])
            if unique([row["constraint"] for row in spatial], "공간 검수") != spatial_ids:
                raise ValueError(f'{output["format"]}의 공간·비례 검수 ID가 원본 분석과 다릅니다.')
            for row in spatial:
                if not row["region"].strip():
                    raise ValueError(f'{row["constraint"]}를 확인한 출력 위치가 필요합니다.')
            observations.extend(spatial)
        if "overall" in output:
            observations.append(output["overall"])
        for row in observations:
            check_observation(row, require_action=bool(selected_anchors or spatial_ids) or "overall" in output)
        allowed = {"partial"} if selected_anchors else {"final", "draft"}
        if output["disposition"] not in allowed:
            raise ValueError("부분 검수는 partial, 전체 검수는 final 또는 draft로 기록하세요.")
        if output["disposition"] == "final" and any(row["status"] != "pass" for row in observations):
            raise ValueError(f'{output["format"]}에 미해결 경계 또는 공간 판정이 있습니다')


def verify_png(path, expected_hash, require_hash):
    with path.open("rb") as file:
        if file.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"{path.name}은 PNG가 아닙니다.")
        if not require_hash:
            return
        digest = hashlib.sha256()
        file.seek(0)
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != expected_hash:
        raise ValueError(f"{path.name}이 검수한 파일과 다릅니다. 현재 파일을 재검수하세요.")


def verify_files(reviews, directory, require_final):
    for output in reviews:
        if require_final and (output["disposition"] != "final" or "overall" not in output):
            raise ValueError(f'{output["format"]}의 최종 검수가 남아 있습니다.')
        if not require_final and "overall" not in output and output["disposition"] != "partial":
            continue  # Legacy reference records can live apart from their print files.
        verify_png(directory / output["output"], output.get("sha256"), require_final)
        if output["format"] in {"psa", "brg"}:
            if (directory / output["preview"]).resolve() == (directory / output["output"]).resolve():
                raise ValueError("슬랩의 인쇄 PNG와 장착 미리보기를 각각 확인하세요.")
            verify_png(directory / output["preview"], output.get("preview_sha256"), require_final)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("format", choices=FORMATS)
    parser.add_argument("analysis", type=Path)
    parser.add_argument("review", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--require-final", action="store_true", help="최종 판정과 검수한 PNG의 SHA-256까지 확인")
    mode.add_argument("--anchors", nargs="+", metavar="ID", help="지정한 경계만 부분 검수")
    args = parser.parse_args()
    try:
        reviews = json.loads(args.review.read_text())["outputs"]
        verify(json.loads(args.analysis.read_text()), reviews, FORMATS[args.format], args.anchors, args.require_final)
        verify_files(reviews, args.review.parent, args.require_final)
    except (ValueError, KeyError, TypeError, AttributeError, OSError) as error:
        parser.exit(1, f"검수 기록 확인 필요: {error}\n")
    if args.anchors:
        print("요청 범위의 부분 검수 기록이 일치합니다.")
    elif args.require_final:
        print("최종 검수 기록과 PNG가 일치합니다.")
    else:
        print("요청 규격과 네 변의 검수 기록이 일치합니다.")
