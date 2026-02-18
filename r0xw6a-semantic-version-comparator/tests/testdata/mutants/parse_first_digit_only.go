package semver

import "strings"

func Compare(a, b string) int {
	partsA := parse(a)
	partsB := parse(b)
	limit := 3
	if len(partsA) < limit {
		limit = len(partsA)
	}
	if len(partsB) < limit {
		limit = len(partsB)
	}
	for i := 0; i < limit; i++ {
		va := 0
		vb := 0
		if i < len(partsA) {
			va = partsA[i]
		}
		if i < len(partsB) {
			vb = partsB[i]
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
	if idx := strings.Index(s, "-"); idx >= 0 {
		s = s[:idx]
	}
	parts := strings.Split(s, ".")
	var nums []int
	for _, p := range parts {
		n := 0
		// WRONG on purpose: take ONLY the first digit in each component (if any).
		for _, c := range p {
			if c >= '0' && c <= '9' {
				n = int(c - '0')
				break
			}
		}
		nums = append(nums, n)
	}
	return nums
}
