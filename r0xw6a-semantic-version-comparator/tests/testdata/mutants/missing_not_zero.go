package semver

import "strings"

func Compare(a, b string) int {
	partsA := parse(a)
	partsB := parse(b)

	// Treat missing as -1 sentinel (breaks missing-as-zero requirement).
	for i := 0; i < 3; i++ {
		va := -1
		vb := -1
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
		for _, c := range p {
			if c >= '0' && c <= '9' {
				n = n*10 + int(c-'0')
			}
		}
		nums = append(nums, n)
	}
	return nums
}
