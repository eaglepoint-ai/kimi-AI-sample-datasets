package semver

import "strings"

func Compare(a, b string) int {
	pa := parse(a)
	pb := parse(b)

	limit := 3
	if len(pa) < limit {
		limit = len(pa)
	}
	if len(pb) < limit {
		limit = len(pb)
	}

	for i := 0; i < limit; i++ {
		va, vb := 0, 0
		if i < len(pa) {
			va = pa[i]
		}
		if i < len(pb) {
			vb = pb[i]
		}
		// BUG: if equal, immediately return 0 instead of continuing
		if va == vb {
			return 0
		}
		if va < vb {
			return -1
		}
		return 1
	}
	return 0
}

func parse(s string) []int {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, "-"); i >= 0 {
		s = s[:i]
	}
	parts := strings.Split(s, ".")
	var nums []int
	for _, p := range parts {
		n := 0
		for _, c := range p {
			if c >= '0' && c <= '9' {
				n = n*10 + int(c-'0')
			}
		}
		nums = append(nums, n)
	}
	return nums
}
