"""Download one SNKRDUNK product image into a new local source directory."""
import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit


class ProductMetadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = {}

    def handle_starttag(self, tag, attrs):
        if tag == "meta":
            attrs = dict(attrs)
            self.values[attrs.get("property")] = attrs.get("content", "")


def fetch(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=25) as response:
        return response.read()


def normalize(text):
    return re.sub(r"\s+", " ", text.strip()).casefold()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("product_id", type=int)
    parser.add_argument("identifier", help="exact set and number inside the product title's brackets")
    parser.add_argument("destination", type=Path, help="new directory")
    args = parser.parse_args()
    url = f"https://snkrdunk.com/en/trading-cards/{args.product_id}"
    meta = ProductMetadata()
    meta.feed(fetch(url).decode("utf-8"))
    title = meta.values.get("og:title", "")
    if normalize(args.identifier) not in [normalize(x) for x in re.findall(r"\[([^\]]+)\]", title)]:
        parser.exit(1, f"품번 불일치. 상품 제목: {title}\n")
    image_url = meta.values.get("og:image", "")
    parts = urlsplit(image_url)
    if parts.scheme != "https" or not (parts.hostname or "").endswith(".snkrdunk.com"):
        parser.exit(1, f"상품 이미지 주소 확인 필요: {image_url}\n")
    data = fetch(image_url)
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        suffix = "png"
    elif data.startswith(b"\xff\xd8\xff"):
        suffix = "jpg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        suffix = "webp"
    else:
        parser.exit(1, "상품 이미지의 파일 형식을 확인할 수 없습니다.\n")
    args.destination.mkdir(parents=True, exist_ok=False)
    name = f"source.{suffix}"
    (args.destination / name).write_bytes(data)
    record = dict(product=url, image_url=image_url, title=title, file=name)
    (args.destination / "source.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print(args.destination / name)


if __name__ == "__main__":
    main()
