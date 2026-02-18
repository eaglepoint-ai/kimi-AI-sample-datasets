package semver

import "strings"

func Compare(a, b string) int {
	_ = parse(a)
	_ = parse(b)
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
