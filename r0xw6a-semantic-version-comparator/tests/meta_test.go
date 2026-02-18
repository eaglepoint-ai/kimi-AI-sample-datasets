package tests

import (
	"testing"
)

func TestMeta_Req2_EqualsReturnZero_PassesOnCorrectImpl(t *testing.T) {
	mustPass(t, `^TestCompare_Req2_EqualsReturnZero$`)
}
func TestMeta_Req2_LessThanReturnsMinusOne_PassesOnCorrectImpl(t *testing.T) {
	mustPass(t, `^TestCompare_Req2_LessThanReturnsMinusOne$`)
}
func TestMeta_Req2_GreaterThanReturnsOne_PassesOnCorrectImpl(t *testing.T) {
	mustPass(t, `^TestCompare_Req2_GreaterThanReturnsOne$`)
}
func TestMeta_Req8_MissingComponentsTreatedAsZero_PassesOnCorrectImpl(t *testing.T) {
	mustPass(t, `^TestCompare_Req8_MissingComponentsTreatedAsZero$`)
}
func TestMeta_Req9_PrereleaseSuffixStripped_PassesOnCorrectImpl(t *testing.T) {
	mustPass(t, `^TestCompare_Req9_PrereleaseSuffixStripped$`)
}
func TestMeta_Req7_InvalidInputsNoPanic_PassesOnCorrectImpl(t *testing.T) {
	mustPass(t, `^TestCompare_Req7_InvalidInputsNoPanic$`)
}

func TestMeta_AllFeatureTests_PassOnCorrectImpl(t *testing.T) {
	out, err := runGoTest(repoAfterDir(), "")
	if err != nil {
		t.Fatalf("expected ALL feature tests to PASS on correct implementation, but they failed:\n%s", out)
	}
}

func TestMeta_Req2_EqualsReturnZero_FailsOnBrokenImpl(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req2_EqualsReturnZero$`, "always_greater.go")
}

func TestMeta_Req2_LessThanReturnsMinusOne_FailsOnBrokenImpl(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req2_LessThanReturnsMinusOne$`, "always_equal.go")
}

func TestMeta_Req2_GreaterThanReturnsOne_FailsOnBrokenImpl(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req2_GreaterThanReturnsOne$`, "always_less.go")
}

func TestMeta_Req8_MissingComponentsTreatedAsZero_FailsOnBrokenImpl(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req8_MissingComponentsTreatedAsZero$`, "missing_not_zero.go")
}

func TestMeta_Req9_PrereleaseSuffixStripped_FailsOnBrokenImpl(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req9_PrereleaseSuffixStripped$`, "prerelease_affects_comparison.go")
}

func TestMeta_Req7_InvalidInputsNoPanic_FailsOnBrokenImpl(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req7_InvalidInputsNoPanic$`, "panic_on_empty.go")
}

func TestMeta_Additional_EdgeCases_PassesOnCorrectImpl(t *testing.T) {
	mustPass(t, `^TestCompare_Additional_EdgeCasesBehaviorPinned$`)
}


func TestMeta_Additional_EdgeCases_FailsOnBrokenImpl(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Additional_EdgeCasesBehaviorPinned$`, "parse_first_digit_only.go")
}

func TestMeta_Req2_LessThan_FailsOnEarlyReturnEqual(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req2_LessThanReturnsMinusOne$`, "early_return_equal.go")
}

func TestMeta_Req8_MissingComponents_FailsOnHardcodedLoop(t *testing.T) {
	mustFailWithMutant(t, `^TestCompare_Req8_MissingComponentsTreatedAsZero$`, "hardcoded_loop.go")
}
