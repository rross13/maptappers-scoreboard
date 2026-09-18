"""
Reconstructs the Real Maptappers Slack history as a JSON file for the backfill.

Score values, dates, authors and puzzle numbers are transcribed verbatim from the
channel. The emoji tile art is regenerated rather than transcribed: for Size It
Up's older bar layout and for Krillion the tiles carry no score information, and
for Globle only the tile COUNT matters (it is cross-checked against "= N"), which
is preserved exactly.
"""
import json

RED, WHITE = ":large_red_square:", ":white_large_square:"
GREEN, ORANGE, YELLOW = ":large_green_square:", ":large_orange_square:", ":large_yellow_square:"

def grid5(rows):
    """Newer Size It Up: five squares plus the row's own score."""
    out = []
    for score in rows:
        filled = round(score / 20)
        out.append(RED * filled + WHITE * (5 - filled) + f" {score}")
    return "\n".join(out)

def bar10(counts):
    """Older Size It Up: a ten-square bar, no trailing number."""
    return "\n".join(RED * c + WHITE * (10 - c) for c in counts)

def globle_tiles(n, wrap=None):
    """n tiles, last one green. `wrap` splits after that many tiles."""
    tiles = [ORANGE if i % 3 == 0 else (YELLOW if i % 3 == 1 else RED) for i in range(n - 1)]
    tiles.append(GREEN)
    if wrap:
        return "".join(tiles[:wrap]) + "\n" + "".join(tiles[wrap:]) + f" = {n}"
    return "".join(tiles) + f" = {n}"

def maptap(date, rounds, final):
    line = " ".join(f"{r}:dart:" for r in rounds)
    return f"www.maptap.gg {date}\n{line}\nFinal score: {final}"

def krillion(num, score, tiles=7):
    art = "".join(":fish:" if i % 2 else ":bubbles:" for i in range(tiles))
    return f"Krillion #{num} :shrimp:\n{score}\n\n{art}"

def siu_new(total, rows):
    return f"Size It Up\nOverall Score {total}\n\n{grid5(rows)}\nhttps://magnitudle.com/size-it-up"

def siu_old(total, counts):
    return f"Size It Up\nOverall Score {total}\n{bar10(counts)}\nmagnitudle.com/size-it-up"

def globle(date, streak, avg, guesses, wrap=None, header=False):
    head = "Globle Stats\n" if header else ""
    return (f"{head}:earth_americas: {date} :earth_africa:\n"
            f":fire: {streak} | Avg. Guesses: {avg}\n"
            f"{globle_tiles(guesses, wrap)}\n\ngloble-game.com\n#globle")

def fermi(num, rounds, total, pct):
    rl = "\n".join(f"{i+1:02d}  {r}×" for i, r in enumerate(rounds))
    return f"Fermi · No. {num}\n{rl}\n─────────\n{total}× score · top {pct}%\nfermi.gg/s/daily"

R, J, Z, S, M, O, W = ("riley@halda.ai", "jackson@halda.ai", "zach.waldrip@halda.ai",
                       "sara@halda.ai", "jarom@halda.ai", "owen@halda.ai", "weston@halda.ai")

M_ = []
def add(ts, author, text):
    M_.append({"ts": ts, "author": author, "text": text})

# ---- Sep 18 ----
add("2026-09-18T09:16:53-06:00", J, krillion(65, 185))
add("2026-09-18T09:13:28-06:00", J, siu_new(262, [24, 56, 0, 100, 82]))
add("2026-09-18T09:12:10-06:00", J, maptap("September 18", [99, 80, 93, 80, 89], 872))
add("2026-09-18T09:10:16-06:00", J, globle("Sep 18, 2026", 5, "9.38", 5, header=True))
add("2026-09-18T08:31:18-06:00", S,
    maptap("September 18", [85, 95, 97, 85, 29], 716)
    + "\n\nEverything was going so well\n\n" + siu_new(323, [97, 0, 99, 39, 88])
    + "\n\n" + krillion(65, 110) + "\n\nBasic day")

# ---- Sep 17 ----
add("2026-09-17T14:44:01-06:00", Z, krillion(64, 285))
add("2026-09-17T14:39:59-06:00", Z, siu_new(347, [59, 91, 87, 27, 83]))
add("2026-09-17T14:37:14-06:00", Z, maptap("September 17", [97, 99, 98, 100, 95], 977))
add("2026-09-17T10:37:41-06:00", R, siu_new(250, [52, 35, 71, 92, 0]))
add("2026-09-17T10:35:44-06:00", R, fermi(53, ["1.67", "1.83", "3.35"], "2.28", 10))
add("2026-09-17T10:32:53-06:00", R, krillion(64, 255))
add("2026-09-17T10:30:06-06:00", R, maptap("September 17", [90, 99, 98, 96, 71], 886))
add("2026-09-17T10:28:17-06:00", S,
    maptap("September 17", [84, 83, 95, 81, 84], 852)
    + "\n\nKrillion ∞ #1 :shrimp:\n290\n\n:squid::bubbles::squid::squid::squid::fish::bubbles:"
    + "\n\n" + siu_new(162, [43, 34, 7, 28, 50])
    + "\n\nI don't believe in myself enough to even play globle")
add("2026-09-17T10:27:51-06:00", R, "Globle in 20 :skull:")
add("2026-09-17T10:21:32-06:00", J, krillion(64, 195))
add("2026-09-17T10:18:20-06:00", J, globle("Sep 17, 2026", 4, "10", 7, header=True))
add("2026-09-17T10:16:41-06:00", J, siu_new(164, [65, 60, 0, 39, 0]))
add("2026-09-17T10:14:42-06:00", J, maptap("September 17", [92, 100, 100, 87, 85], 908))
add("2026-09-17T09:56:06-06:00", M, "Globle in 9")
add("2026-09-17T09:56:02-06:00", M, siu_new(361, [58, 48, 87, 70, 98]))
add("2026-09-17T09:49:46-06:00", M, krillion(64, 230))
add("2026-09-17T09:47:22-06:00", M, maptap("September 17", [93, 98, 98, 88, 87], 912))

# ---- Sep 16 ----
add("2026-09-16T10:33:47-06:00", J, fermi(52, ["9.09", "2.93", "2.13"], "4.72", 23))
add("2026-09-16T10:32:38-06:00", Z, fermi(52, ["1.25", "122", "1.75"], "41.7", 79))
add("2026-09-16T10:29:35-06:00", Z, siu_old(335, [8, 9, 6, 6, 4]))
add("2026-09-16T10:24:53-06:00", Z, krillion(63, 320))
add("2026-09-16T10:24:13-06:00", O, globle("Sep 16, 2026", 1, "9", 6, header=True))
add("2026-09-16T10:23:04-06:00", R,
    maptap("September 16", [96, 86, 88, 4, 74], 592)
    + "\n\n" + globle("Sep 16, 2026", 3, "9.67", 9, wrap=8, header=True)
    + "\n\n" + krillion(63, 170)
    + "\n\n" + fermi(52, ["1.25", "8.14", "1.50"], "3.63", 19)
    + "\n\n" + siu_old(296, [6, 6, 7, 8, 3]))
add("2026-09-16T10:22:57-06:00", O, maptap("September 16", [93, 100, 99, 90, 62], 847))
add("2026-09-16T10:19:34-06:00", Z, globle("Sep 16, 2026", 1, "8.14", 4))
add("2026-09-16T10:18:27-06:00", Z, maptap("September 16", [94, 100, 99, 86, 90], 920))
add("2026-09-16T09:48:41-06:00", J, siu_old(166, [10, 2, 0, 3, 2]))
add("2026-09-16T09:47:11-06:00", J, krillion(63, 310))
add("2026-09-16T09:44:38-06:00", J, globle("Sep 16, 2026", 3, "10.5", 7))
add("2026-09-16T09:43:33-06:00", J, maptap("September 16", [87, 98, 71, 52, 94], 765))
add("2026-09-16T08:34:38-06:00", M,
    maptap("September 16", [96, 94, 90, 92, 70], 856)
    + "\n\n" + fermi(52, ["3.99", "32.6", "1.25"], "12.6", 46)
    + "\n\n" + globle("Sep 16, 2026", 9, "7.27", 4)
    + "\n\n" + krillion(63, 120)
    + "\n\n" + siu_old(281, [9, 7, 4, 5, 4]))

# ---- Sep 15 ----
add("2026-09-15T16:24:31-06:00", S, fermi(51, ["3.16", "15.4", "4,656"], "340", 86))
add("2026-09-15T16:23:42-06:00", S, siu_old(138, [0, 3, 2, 8, 0]) + "\n\nOuch rough day all around")
add("2026-09-15T16:21:59-06:00", S, maptap("September 15", [96, 98, 45, 80, 56], 692) + "\n\nROUGH DAY")
add("2026-09-15T11:27:24-06:00", R, siu_old(158, [0, 6, 3, 5, 1]))
add("2026-09-15T11:26:54-06:00", Z, maptap("September 15", [91, 100, 100, 94, 81], 916))
add("2026-09-15T11:25:26-06:00", R, fermi(51, ["1.56", "4.62", "2,587"], "335", 86))
add("2026-09-15T11:23:40-06:00", Z, fermi(51, ["2.77", "1.86", "140"], "48.1", 51))
add("2026-09-15T11:22:57-06:00", R, krillion(62, 140))
add("2026-09-15T11:21:35-06:00", Z, siu_old(219, [0, 7, 0, 10, 5]))
add("2026-09-15T11:19:51-06:00", R, globle("Sep 15, 2026", 2, "9.8", 6))
add("2026-09-15T11:18:30-06:00", R, maptap("September 15", [94, 83, 91, 92, 92], 911))
add("2026-09-15T11:16:20-06:00", Z, "that was horrible " + krillion(62, 180))
add("2026-09-15T11:13:56-06:00", Z, "I got globle in 9, but had to look it up, I got every country around and could not remember it for the life of me")
add("2026-09-15T10:58:56-06:00", J, siu_old(205, [0, 7, 3, 10, 2]))
add("2026-09-15T10:56:34-06:00", J, krillion(62, 100))
add("2026-09-15T10:53:09-06:00", J, globle("Sep 15, 2026", 2, "11.2", 13, wrap=8))
add("2026-09-15T10:50:15-06:00", J, maptap("September 15", [95, 90, 91, 86, 63], 814))
add("2026-09-15T10:32:38-06:00", M, "Absolutely horrendous on size it up\n\n" + siu_old(171, [0, 4, 2, 5, 6]))
add("2026-09-15T10:28:01-06:00", M, globle("Sep 15, 2026", 8, "7.6", 6))
add("2026-09-15T10:25:46-06:00", M, "Not my best day\n\n" + maptap("September 15", [98, 98, 85, 78, 60], 780))

# ---- Sep 14 ----
add("2026-09-14T11:04:42-06:00", S, maptap("September 14", [87, 95, 96, 52, 59], 707))
add("2026-09-14T10:59:44-06:00", J, siu_old(318, [4, 8, 9, 5, 6]))
add("2026-09-14T10:49:04-06:00", M, siu_old(340, [5, 10, 10, 7, 3]))
add("2026-09-14T10:42:56-06:00", R, "Dude that's way hard :joy:\n\n" + siu_old(240, [4, 7, 10, 0, 3]))
add("2026-09-14T10:40:48-06:00", O, siu_old(173, [3, 3, 4, 4, 4]))
add("2026-09-14T10:38:53-06:00", O, globle("Sep 14, 2026", 1, "7", 7))
add("2026-09-14T10:36:26-06:00", S, siu_old(286, [4, 7, 3, 4, 10]))
add("2026-09-14T10:34:53-06:00", O, maptap("September 14", [96, 98, 95, 77, 87], 876))
add("2026-09-14T10:10:38-06:00", Z, "ok last game I swear\n" + siu_old(353, [4, 10, 10, 8, 3]))
add("2026-09-14T10:07:23-06:00", Z, maptap("September 14", [100, 95, 99, 90, 97], 954))
add("2026-09-14T10:04:42-06:00", Z, krillion(61, 280))
add("2026-09-14T10:02:01-06:00", Z, globle("Sep 14, 2026", 1, "8.33", 6) + "\n\nask me to do my king julian impression some time")
add("2026-09-14T10:00:21-06:00", J, maptap("September 14", [90, 94, 97, 87, 98], 933))
add("2026-09-14T09:44:43-06:00", R, "I can't lie I think I popped off today\n\n" + krillion(61, 375))
add("2026-09-14T09:42:49-06:00", M, globle("Sep 14, 2026", 7, "7.78", 5))
add("2026-09-14T09:41:18-06:00", R, maptap("September 14", [87, 90, 95, 86, 97], 916))
add("2026-09-14T09:38:59-06:00", R, "Rip\n" + globle("Sep 14, 2026", 1, "10.75", 15, wrap=8))
add("2026-09-14T09:33:47-06:00", S, fermi(50, ["41.8", "5.66", "266,667"], "349", 89) + "\n\nholy heck that was hard")
add("2026-09-14T09:32:40-06:00", M, maptap("September 14", [96, 98, 94, 80, 93], 901))
add("2026-09-14T09:30:24-06:00", R, fermi(50, ["27.9", "3.18", "66.7"], "32.6", 60))
add("2026-09-14T09:29:04-06:00", M, fermi(50, ["3.35", "1.42", "53,333"], "335", 89))
add("2026-09-14T09:27:12-06:00", Z, "try this game:\n" + fermi(50, ["29.5", "1.05", "20.0"], "16.9", 50) + "\n\nI sucked")

# ---- Sep 13 ----
add("2026-09-13T11:39:13-06:00", M, "Glad I had at least one leg up on Jackson :sweat_smile: 7 on Globle")
add("2026-09-13T11:37:44-06:00", J, krillion(60, 170))
add("2026-09-13T11:34:38-06:00", J, "Globle 20 guesses :sweat_smile:")
add("2026-09-13T11:30:17-06:00", J, maptap("September 13", [100, 91, 93, 80, 91], 890))
add("2026-09-13T11:27:12-06:00", M, maptap("September 13", [96, 98, 86, 80, 73], 825))
add("2026-09-13T11:12:37-06:00", S, maptap("September 13", [90, 93, 84, 82, 81], 840))

# ---- Sep 12 ----
add("2026-09-12T14:34:09-06:00", M, "Darn you Owen\n\n" + maptap("September 12", [73, 95, 96, 91, 80], 873))
add("2026-09-12T14:33:16-06:00", O, maptap("September 12", [86, 97, 96, 85, 98], 924))

# ---- Sep 11 ----
add("2026-09-11T15:54:08-06:00", R, krillion(58, 110))
add("2026-09-11T15:50:38-06:00", M, krillion(58, 120))
add("2026-09-11T15:48:11-06:00", R, "Globle in 9")
add("2026-09-11T15:46:37-06:00", R, maptap("September 11", [97, 80, 82, 99, 85], 893))
add("2026-09-11T15:46:26-06:00", M, "Globle in 8")
add("2026-09-11T15:42:20-06:00", M, maptap("September 11", [96, 73, 78, 80, 86], 823))
add("2026-09-11T11:31:13-06:00", O, "Globle in 5")
add("2026-09-11T11:29:41-06:00", O, maptap("September 11", [97, 86, 86, 88, 93], 898))
add("2026-09-11T11:25:18-06:00", W, krillion(58, 235) + "\n\nThis game is hard lol\n\nJackson you are cracked")
add("2026-09-11T11:20:55-06:00", W, "Globle: 7")
add("2026-09-11T11:19:43-06:00", W, "yall are cracked:\n\n" + maptap("September 11", [95, 80, 58, 94, 75], 798))
add("2026-09-11T11:11:38-06:00", J, krillion(58, 340))
add("2026-09-11T11:08:59-06:00", Z, krillion(58, 250))
add("2026-09-11T11:08:24-06:00", J, "Globle in 6")
add("2026-09-11T11:06:54-06:00", J, maptap("September 11", [95, 84, 80, 83, 84], 840))
add("2026-09-11T11:05:27-06:00", Z, "Globle in 6")
add("2026-09-11T11:03:46-06:00", Z, maptap("September 11", [97, 95, 80, 100, 88], 916))

# ---- Sep 10 ----
add("2026-09-10T14:31:12-06:00", Z, krillion(57, 210))
add("2026-09-10T13:36:58-06:00", R, krillion(57, 130))
add("2026-09-10T13:33:24-06:00", R, globle("Sep 10, 2026", 2, "9.5", 8))
add("2026-09-10T13:30:29-06:00", R, maptap("September 10", [98, 90, 95, 86, 96], 924))
add("2026-09-10T12:10:30-06:00", Z, "Tough day today\n" + maptap("September 10", [98, 86, 79, 82, 86], 846))
add("2026-09-10T12:10:12-06:00", M, krillion(57, 160))
add("2026-09-10T12:06:05-06:00", M, "Globe in 9 :sob:")
add("2026-09-10T12:01:20-06:00", M, maptap("September 10", [97, 98, 69, 80, 78], 807))
add("2026-09-10T11:52:02-06:00", S, maptap("September 10", [96, 92, 77, 80, 80], 822))

# ---- Sep 9 (channel starts) ----
add("2026-09-09T10:50:57-06:00", S, maptap("September 9", [97, 94, 87, 56, 97], 824) + "\n\nguys I'm so bad at geography pls don't judge I need to study")
add("2026-09-09T10:50:12-06:00", S, krillion(56, 255) + "\n\nWow I'm\nBasic")
add("2026-09-09T10:16:18-06:00", O, "I got it in 10")
add("2026-09-09T10:13:28-06:00", M, "Got blasted on Globle. 12, and I had to cheat")
add("2026-09-09T10:11:47-06:00", R, krillion(56, 210))
add("2026-09-09T10:10:53-06:00", O, krillion(56, 220))
add("2026-09-09T10:09:34-06:00", M, krillion(56, 250))
add("2026-09-09T10:07:10-06:00", O, maptap("September 9", [96, 98, 80, 87, 93], 894))
add("2026-09-09T10:06:27-06:00", R, maptap("September 9", [97, 96, 82, 99, 95], 939))
add("2026-09-09T10:05:18-06:00", Z, krillion(56, 365))
add("2026-09-09T09:36:30-06:00", M, maptap("September 9", [97, 90, 82, 71, 93], 843))
add("2026-09-09T09:28:10-06:00", Z, maptap("September 9", [98, 100, 80, 94, 96], 928))

with open("data/slack-history.json", "w", encoding="utf-8") as fh:
    json.dump(M_, fh, ensure_ascii=False, indent=1)
print(f"wrote {len(M_)} messages to data/slack-history.json")
