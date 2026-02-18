package semver

import "strings"

func Compare(a, b string) int {
	pa := parse(a)
	pb := parse(b)

	for i := 0; i < 3; i++ { // BUG: ignores actual lengths
		va, vb := 0, 0
		if i < len(pa) {
			va = pa[i]
		}
		if i < len(pb) {
			vb = pb[i]
		}
		if va < vb {
			return -1
		}
		if va > vb {
			return 1
		}
	}
	return 0
}

func parse(s string) []int {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, "-"); i >= 0 {
		s = s[:i]
	}
	parts := strings.Split(s, ".")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		n := 0
		for _, c := range p {
			if c >= '0' && c <= '9' {
				n = n*10 + int(c-'0')
			}
		}
		out = append(out, n)
	}
	return out
}
