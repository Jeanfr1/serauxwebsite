"""Measures the ink boxes of every text block on the approved board
(02-direcao/composicao-final.png, 1024 px wide) and writes scripts/board.json.

The desktop layout places live text in board px (1 board px = --u on the page);
scripts/fit-text.mjs turns these boxes into font sizes and offsets.
Usage: python3 scripts/measure-board.py [--overlay out.png]
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
board = cv2.imread(os.path.join(ROOT, '02-direcao/composicao-final.png')).astype(np.int32)
B, G, R = board[..., 0], board[..., 1], board[..., 2]
GRAY = (B + G + R) / 3
RED = (R > 140) & (G < 95) & (B < 95) & (R - G > 80)
MASKS = {
    'red': RED,
    'dark': (GRAY < 110) & ~RED,
    'pencil': (GRAY < 150) & ~RED,
    'white': (R > 225) & (G > 215) & (B > 215),
    'ink': (np.abs(board - [224, 233, 240]).sum(2) > 90),
}

# name: (window x0, y0, x1, y1 in board px, mask)
WINDOWS = {
    'logo': ((40, 5, 440, 110), 'ink'),
    'nav1': ((490, 22, 572, 48), 'dark'),
    'nav2': ((580, 22, 645, 48), 'dark'),
    'nav3': ((652, 22, 710, 48), 'dark'),
    'nav4': ((715, 22, 782, 48), 'dark'),
    'headBtn': ((785, 8, 995, 62), 'red'),
    'headBtnText': ((805, 22, 946, 48), 'white'),
    'headBtnArrow': ((946, 22, 970, 48), 'white'),
    'eyebrow1': ((55, 128, 205, 147), 'red'),
    'eyebrow2': ((55, 147, 262, 166), 'red'),
    'h1a': ((55, 175, 470, 275), 'dark'),
    'h1b': ((55, 270, 215, 352), 'dark'),
    'h1c': ((215, 270, 512, 352), 'red'),
    'intro1': ((55, 364, 430, 388), 'dark'),
    'intro2': ((55, 388, 430, 412), 'dark'),
    's1t1': ((38, 638, 312, 696), 'red'),
    's1t2': ((38, 694, 312, 754), 'dark'),
    's1rule': ((38, 757, 150, 769), 'ink'),
    's1p1': ((40, 776, 292, 797), 'dark'),
    's1p2': ((40, 797, 292, 818), 'dark'),
    's1p3': ((40, 818, 292, 841), 'dark'),
    's1note': ((228, 872, 345, 975), 'pencil'),
    's2t1': ((760, 1008, 978, 1060), 'red'),
    's2t2': ((760, 1060, 978, 1119), 'dark'),
    's2rule': ((760, 1123, 860, 1133), 'ink'),
    's2p1': ((765, 1142, 1002, 1164), 'dark'),
    's2p2': ((765, 1164, 1002, 1185), 'dark'),
    's2p3': ((765, 1185, 1002, 1208), 'dark'),
    's2note': ((888, 1218, 1012, 1308), 'pencil'),
    's3t1': ((40, 1330, 282, 1375), 'red'),
    's3t2a': ((40, 1376, 90, 1413), 'red'),
    's3t2b': ((88, 1376, 192, 1413), 'dark'),
    's3addr': ((40, 1419, 300, 1447), 'dark'),
    's3btn': ((40, 1449, 272, 1512), 'red'),
    's3btnText': ((60, 1466, 190, 1496), 'white'),
    's3btnArrow': ((205, 1466, 245, 1496), 'white'),
}


def ink_box(name):
    (x0, y0, x1, y1), mode = WINDOWS[name]
    sub = MASKS[mode][y0:y1, x0:x1].astype(np.uint8)
    # drop isolated specks (paper grain, construction-line crumbs)
    n, lab, st, _ = cv2.connectedComponentsWithStats(sub)
    keep = np.isin(lab, 1 + np.nonzero(st[1:, 4] >= 3)[0])
    ys, xs = np.nonzero(keep)
    return [int(x0 + xs.min()), int(y0 + ys.min()), int(x0 + xs.max() + 1), int(y0 + ys.max() + 1)]


def main():
    out = {name: ink_box(name) for name in WINDOWS}
    out['_sections'] = {'hero': [0, 614], 's1': [620, 983], 's2': [990, 1311], 's3': [1318, 1536]}
    path = os.path.join(ROOT, 'scripts', 'board.json')
    with open(path, 'w') as fh:
        json.dump(out, fh, indent=1)
    for k, v in out.items():
        print(k, v)
    if '--overlay' in sys.argv:
        ov = board.astype(np.uint8).copy()
        for k, v in out.items():
            if k.startswith('_'):
                continue
            cv2.rectangle(ov, (v[0], v[1]), (v[2] - 1, v[3] - 1), (255, 160, 0), 1)
        cv2.imwrite(sys.argv[sys.argv.index('--overlay') + 1], ov)


if __name__ == '__main__':
    main()
