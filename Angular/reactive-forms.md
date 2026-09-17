# Reactive Forms

Reactive forms (also called model-driven forms) are Angular's API for building forms where the entire form model — `FormControl`, `FormGroup`, and `FormArray` instances — is constructed explicitly in the component class using TypeScript, and the template merely binds to that pre-existing model rather than creating it. This is the inverse of template-driven forms, where the directives in the template are the source of truth and Angular derives the model behind the scenes. Because the model is a plain object graph you build yourself, it is synchronous, immutable-by-replacement, and directly unit-testable without rendering a template or touching the DOM at all — you can construct a `FormGroup`, call `.setValue()`, assert on `.valid`, and never instantiate a component.

The building blocks are `AbstractControl` subclasses: a `FormControl` wraps a single value (and its validation state), a `FormGroup` wraps a fixed set of named child controls (like an object), and a `FormArray` wraps an ordered list of child controls (like an array) — useful for dynamic, repeatable form sections such as "add another phone number." `FormBuilder` (injected as `fb`) is a convenience service that removes the boilerplate of `new FormControl(...)`/`new FormGroup(...)` calls, letting you write `fb.group({ name: ['', Validators.required] })` instead. Validators come in two flavors: synchronous (`Validators.required`, `Validators.minLength(3)`, `Validators.pattern(/regex/)`, or a custom function of shape `(control: AbstractControl) => ValidationErrors | null`) and asynchronous (functions returning an `Observable<ValidationErrors | null>` or a `Promise`, used for things like server-side "is this username taken" checks); async validators run only after all sync validators pass, and the control's status transitions to `PENDING` while they're in flight.

Since Angular 14, reactive forms can be strictly typed: `FormControl<string>` instead of the old `FormControl` (which was implicitly `any`). `fb.group({...})` infers the typed shape automatically, so `form.value.name` is typed as `string | undefined` rather than `any`, catching typos and wrong-type assignments at compile time. This was a significant improvement over the historically weak typing of reactive forms, which used to be one of the framework's few genuinely untyped corners.

Because every control is an object with its own state, reactive forms expose two Observables per control: `valueChanges` (emits the new value whenever it changes) and `statusChanges` (emits `'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'` whenever validation status changes). This makes it trivial to compose forms with RxJS — debounce a search box, derive one field from another, or disable a submit button based on a combination of control states — using the same operators you'd use anywhere else in the app, since a `FormControl` is essentially a stateful Observable wrapper with imperative getters bolted on. Reactive forms are the preferred approach for anything nontrivial: complex validation logic, dynamic form structure, forms driven by data (e.g., rendering fields from a JSON schema), or forms that must be covered by real unit tests — precisely because the form's behavior lives in plain, synchronously-testable class code instead of being smeared across template directives.

## Examples

```ts
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="signupForm" (ngSubmit)="onSubmit()">
      <input formControlName="email" placeholder="Email" />
      @if (signupForm.get('email')?.invalid && signupForm.get('email')?.touched) {
        <p class="error">Enter a valid email.</p>
      }

      <div formGroupName="address">
        <input formControlName="street" placeholder="Street" />
        <input formControlName="city" placeholder="City" />
      </div>

      <div formArrayName="phones">
        @for (phone of phones.controls; track $index; let i = $index) {
          <input [formControlName]="i" placeholder="Phone" />
        }
      </div>
      <button type="button" (click)="addPhone()">+ Add phone</button>

      <button type="submit" [disabled]="signupForm.invalid">Sign up</button>
    </form>
  `,
})
export class SignupComponent {
  private fb = inject(FormBuilder);

  // The entire model is built here, in the class — the template only binds to it.
  signupForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    address: this.fb.group({
      street: [''],
      city: [''],
    }),
    phones: this.fb.array([this.fb.control('')]),
  });

  get phones(): FormArray {
    return this.signupForm.get('phones') as FormArray;
  }

  addPhone(): void {
    this.phones.push(this.fb.control(''));
  }

  onSubmit(): void {
    if (this.signupForm.invalid) return;
    console.log(this.signupForm.value); // { email, address: {...}, phones: [...] }
  }
}
```

This shows `FormGroup` nesting (`formGroupName`), a `FormArray` for a dynamic list of phone numbers (`formArrayName`), and the built-in `Validators.required`/`Validators.email`.

```ts
import { AbstractControl, ValidationErrors, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { map, catchError, of, delay } from 'rxjs';

// Custom synchronous validator: cross-field check that password === confirmPassword.
export const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pass === confirm ? null : { passwordsMismatch: true };
};

// Custom async validator: simulates a server call to check username availability.
export function usernameTakenValidator(api: { checkUsername(name: string): Promise<boolean> }): AsyncValidatorFn {
  return (control: AbstractControl) => {
    if (!control.value) return of(null);
    return of(control.value).pipe(
      delay(300), // debounce-like delay so we don't hit the "server" on every keystroke
      map(async (name) => (await api.checkUsername(name)) ? { usernameTaken: true } : null),
      catchError(() => of(null)),
    );
  };
}
```

Custom validators are just functions — sync ones return `ValidationErrors | null` synchronously, async ones return an `Observable`/`Promise` of the same shape; Angular merges the results from every validator attached to a control.

```ts
import { Component, inject, DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<input [formControl]="query" placeholder="Search..." />`,
})
export class SearchComponent {
  private fb = inject(FormBuilder);
  query = this.fb.control<string>(''); // typed FormControl<string>

  constructor() {
    this.query.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => console.log('search for:', term));
  }
}
```

`valueChanges` is a plain Observable, so standard RxJS operators (`debounceTime`, `distinctUntilChanged`) apply directly — this is the classic reactive-forms pattern for a debounced search box, and `takeUntilDestroyed()` handles unsubscription automatically.

## Common Pitfalls / Gotchas

- Forgetting that `formControlName`/`formGroupName`/`formArrayName` bind by *name string*, not by reference — a typo in the string silently fails to bind (throws `NG01352` in newer Angular versions, but historically failed silently).
- Calling `.setValue()` on a `FormGroup`/`FormArray` requires providing every key/index exactly — it throws if any are missing; use `.patchValue()` when you only want to update a subset.
- Async validators put the control in `PENDING` status while resolving — checking `form.valid` immediately after a value change (before the async validator resolves) can give a false positive/negative; you generally need to await `statusChanges` or check for `PENDING`.
- `valueChanges`/`statusChanges` subscriptions are ordinary Observable subscriptions and leak just like any other if not cleaned up — use `takeUntilDestroyed()` (Angular 16+) or manually unsubscribe in `ngOnDestroy`.
- Disabled controls (`{ disabled: true }` or `.disable()`) are excluded from `FormGroup.value` entirely (use `.getRawValue()` to include them), which is a frequent source of "why is my field missing from the submitted payload" bugs.
- Typed forms (Angular 14+) can produce more verbose/strict types than people expect — `FormBuilder.group()`'s inferred type doesn't automatically make fields optional/nullable unless you explicitly type them that way, which trips people migrating older untyped code.

## Interview Questions & Answers

**Q: What's the core architectural difference between reactive forms and template-driven forms?**
A: In reactive forms, the `FormGroup`/`FormControl` tree is constructed explicitly in the component class, and the template's directives (`formControlName`, etc.) just bind to that existing model — the class is the source of truth. In template-driven forms, the model doesn't exist upfront; Angular creates a hidden `FormControl` for each `ngModel` directive it encounters and assembles them into an implicit `NgForm`/`FormGroup` behind the scenes — the template is the source of truth. This is why reactive forms are synchronous and directly unit-testable (construct the `FormGroup`, no rendering needed) while template-driven forms require rendering the component to inspect form state.

**Q: How do you implement a custom synchronous validator, and what must it return?**
A: A custom validator is a function matching `ValidatorFn`: `(control: AbstractControl) => ValidationErrors | null`. It returns `null` if the control is valid, or an object like `{ someErrorKey: true }` (optionally with details) if invalid. You attach it alongside built-in validators, e.g. `new FormControl('', [Validators.required, myValidator])`, and Angular merges the error objects from every validator that fails into `control.errors`.

**Q: What's the difference between `setValue()` and `patchValue()` on a `FormGroup`?**
A: `setValue()` requires you to supply a value for every control in the group (or array) — it throws an error if any key is missing or if you include extra unknown keys. `patchValue()` accepts a partial object and only updates the controls you actually provide, leaving the rest untouched — it's the safer default when you're updating a subset of fields, e.g. patching in server-returned data onto a form that also has client-only fields.

**Q: Why would you use `FormArray` instead of just a plain array of `FormControl`s on the component?**
A: `FormArray` is itself an `AbstractControl`, so it participates in the same validity/value aggregation as the rest of the form tree — the parent `FormGroup`'s `.valid`/`.value` automatically reflects the state of every control inside the array, and you can attach array-level validators (e.g., "at least one phone number required"). A plain TypeScript array of controls wouldn't be wired into that aggregation, and the template directives (`formArrayName`, index-based `formControlName`) specifically expect a `FormArray`.

**Q: How would you debounce a live search field built with reactive forms?**
A: Create a `FormControl` for the input, bind it with `[formControl]`, and subscribe to `query.valueChanges.pipe(debounceTime(300), distinctUntilChanged())`. Because `valueChanges` is a genuine RxJS Observable, all standard operators apply directly with no extra glue code — this is one of the main practical advantages reactive forms have over template-driven forms, where you'd have to manually wire up a `Subject` or use `(ngModelChange)` with your own debounce logic.

## Related Topics

- [template-deriven-forms.md](./template-deriven-forms.md)
- [observables.md](./observables.md)
- [data-binding.md](./data-binding.md)
- [components.md](./components.md)
- [dependency-injection.md](./dependency-injection.md)
