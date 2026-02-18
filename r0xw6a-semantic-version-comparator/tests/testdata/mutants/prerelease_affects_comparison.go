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

	// Intentionally WRONG: prerelease suffix *affects* comparison.
	// If "-" exists, we keep the left side but also bump the patch component by 1.
	bump := 0
	if idx := strings.Index(s, "-"); idx >= 0 {
		s = s[:idx]
		bump = 1
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

	// Ensure at least 3 components so we can bump patch safely.
	for len(nums) < 3 {
		nums = append(nums, 0)
	}
	nums[2] += bump
	return nums
}
