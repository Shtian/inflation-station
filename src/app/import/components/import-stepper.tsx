const STEPS = ["Select Account", "Upload File", "Review & Import"] as const;

type ImportStepperProps = {
  currentStep: 1 | 2 | 3;
};

export function ImportStepper({ currentStep }: ImportStepperProps) {
  return (
    <div className="mb-8 flex gap-2">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber <= currentStep;
        return (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
                style={{ width: isActive ? "100%" : "0%" }}
              />
            </div>
            <span
              className={`text-xs transition-colors duration-300 ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
