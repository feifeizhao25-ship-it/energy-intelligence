class ShadowFinancialCalculator:
        return float(len(cashflows))


@dataclass
class CrossValidationReport:
    """Aggregate report returned by the legacy cross-validation test API."""

    results: Dict[str, ValidationResult]

    @property
    def overall_status(self) -> ValidationStatus:
        if any(result.status == ValidationStatus.BLOCK for result in self.results.values()):
            return ValidationStatus.BLOCK
        if any(result.status == ValidationStatus.WARNING for result in self.results.values()):
            return ValidationStatus.WARNING
        return ValidationStatus.PASS

    @property
    def summary(self) -> Dict[str, int]:
        return {
            "total_metrics": len(self.results),
            "pass": sum(1 for result in self.results.values() if result.status == ValidationStatus.PASS),
            "warning": sum(1 for result in self.results.values() if result.status == ValidationStatus.WARNING),
            "block": sum(1 for result in self.results.values() if result.status == ValidationStatus.BLOCK),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_status": self.overall_status.value,
            "summary": self.summary,
            "results": {key: value.to_dict() for key, value in self.results.items()},
        }


class CrossValidationEngine:
    def validate_all(
        cls,
        primary_results: Dict[str, float],
        cashflows: Optional[List[float]] = None,
        **kwargs,
    ) -> Dict[str, ValidationResult] | CrossValidationReport:
        """批量验证 IRR / NPV / LCOE / Payback."""
        return_report = False
        calculation_inputs = kwargs.pop("calculation_inputs", None)
        if calculation_inputs is not None:
            return_report = True
            cashflows = calculation_inputs.get("cashflows", cashflows)
            kwargs = {**calculation_inputs, **kwargs}

        if cashflows is None:
            raise TypeError("validate_all() missing required cashflows")

        results = {}
        if "irr" in primary_results:
            results["irr"] = cls.validate_irr(primary_results["irr"], cashflows)
            results["payback"] = cls._validate(
                primary_results["payback"], shadow_payback, metric="payback", threshold_pass=0.1
            )
        if return_report:
            return CrossValidationReport(results=results)
        return results
