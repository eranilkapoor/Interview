# Template-Driven Forms

Template-driven forms are Angular's original forms API, built around directives applied directly in the HTML template — primarily `[(ngModel)]` — with `FormsModule` supplying the machinery that watches those directives and builds a form model on your behalf, invisibly, at runtime. Unlike reactive forms, you never write `new FormControl()` or `fb.group({...})` yourself: for every element carrying `ngModel`, Angular silently instantiates a `FormControl` and registers it into an implicit `FormGroup` that lives on an `NgForm` directive, which Angular automatically attaches to every `<form>` element the moment `FormsModule` is imported (no explicit `[formGroup]` binding needed). The practical consequence is that the *template is the source of truth* for the form's structure — the shape of the model is inferred from which elements exist and how they're nested, not declared in the component class.

Validation in template-driven forms is expressed through HTML validation attributes — `required`, `minlength`, `maxlength`, `pattern` — which Angular's built-in directives (`RequiredValidator`, `MinLengthValidator`, `PatternValidator`, etc.) intercept and translate into the same `Validators.required`-style functions used under the hood by reactive forms; both APIs ultimately run through the same `AbstractControl` validation engine, they just differ in how the validators get attached. To inspect a control's state from the template, you export the directive to a template reference variable, e.g. `#email="ngModel"`, which gives you access to `email.invalid`, `email.touched`, `email.dirty`, and `email.errors` right there in the markup — this is the defining stylistic trait of template-driven forms: state inspection and conditional error display happen inline in HTML rather than through property access in the class. For grouping related fields (e.g., a nested "address" section) without a full nested form, `ngModelGroup` creates a nested `FormGroup` the same way `ngModel` creates a `FormControl`, mirroring what `formGroupName` does explicitly in reactive forms.

Template-driven forms suit small, mostly-static forms — a login form, a simple contact form — where the validation rules are fixed and don't need to change at runtime, and where writing a few `ngModel` bindings is genuinely less code than constructing an explicit `FormGroup`. They fall short as forms grow: because the model doesn't exist until the template renders, you can't unit-test form logic without rendering the component and driving it through `TestBed` and the DOM; dynamic form structure (adding/removing fields at runtime, or building forms from a schema) is awkward because it means conditionally rendering/destroying `ngModel`-bound elements rather than just pushing into a `FormArray`; and complex cross-field or asynchronous validation logic has to be expressed as custom directives rather than plain functions. This is exactly why the Angular team, and most production codebases, treat reactive forms as the default for anything beyond a trivial form, while keeping template-driven forms around for quick, simple cases and for teams more comfortable thinking in templates than in RxJS-flavored model classes.

## Examples

```ts
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form #loginForm="ngForm" (ngSubmit)="onSubmit(loginForm)">
      <input
        name="email"
        [(ngModel)]="model.email"
        #email="ngModel"
        required
        email
      />
      @if (email.invalid && email.touched) {
        <p class="error">
          @if (email.errors?.['required']) { Email is required. }
          @if (email.errors?.['email']) { Enter a valid email address. }
        </p>
      }

      <input
        name="password"
        type="password"
        [(ngModel)]="model.password"
        #password="ngModel"
        required
        minlength="8"
      />
      @if (password.invalid && password.touched) {
        <p class="error">Password must be at least 8 characters.</p>
      }

      <button type="submit" [disabled]="loginForm.invalid">Log in</button>
    </form>
  `,
})
export class LoginComponent {
  model = { email: '', password: '' };

  onSubmit(form: NgForm): void {
    if (form.invalid) return;
    console.log(form.value); // { email, password } — built implicitly from ngModel directives
  }
}
```

Note there's no `FormGroup` anywhere in the class — `name` attributes plus `ngModel` are enough for `FormsModule` to assemble the model, and `#loginForm="ngForm"` gives template access to the whole form's aggregate state (`loginForm.invalid`, `loginForm.value`).

```html
<!-- ngModelGroup nests a sub-FormGroup ("address") without writing any TypeScript for it -->
<form #profileForm="ngForm">
  <input name="username" [(ngModel)]="user.username" required />

  <div ngModelGroup="address" #addressGroup="ngModelGroup">
    <input name="street" [(ngModel)]="user.address.street" required />
    <input name="city" [(ngModel)]="user.address.city" required />
    @if (addressGroup.invalid && addressGroup.touched) {
      <p class="error">Complete address is required.</p>
    }
  </div>
</form>
```

`ngModelGroup="address"` produces a nested `FormGroup` under the key `address` in the resulting form value (`{ username, address: { street, city } }`), the template-driven equivalent of `formGroupName`.

```ts
import { Directive } from '@angular/core';
import { NG_VALIDATORS, Validator, AbstractControl, ValidationErrors } from '@angular/forms';

// Custom validation logic in template-driven forms must be wrapped as a directive
// (unlike reactive forms, where it's just a plain function).
@Directive({
  selector: '[appForbiddenName]',
  standalone: true,
  providers: [
    { provide: NG_VALIDATORS, useExisting: ForbiddenNameDirective, multi: true },
  ],
})
export class ForbiddenNameDirective implements Validator {
  validate(control: AbstractControl): ValidationErrors | null {
    return /admin/i.test(control.value) ? { forbiddenName: { value: control.value } } : null;
  }
}
```

```html
<input name="username" [(ngModel)]="user.username" appForbiddenName required />
```

Custom validators must be registered as directives providing `NG_VALIDATORS` with `multi: true`, so Angular's directive-discovery mechanism picks them up on any element they're applied to — a noticeably heavier ceremony than a plain `ValidatorFn`.

## Common Pitfalls / Gotchas

- Every `ngModel` inside a `<form>` **must** have a unique `name` attribute, or Angular throws at runtime ("name attribute must be set") because there's no key to register the control under.
- The form model doesn't exist synchronously on component creation — it's built up as Angular processes the template, so trying to read `loginForm.value` in `ngOnInit` before the view has rendered can give you an incomplete or undefined model.
- Because logic is scattered across template attributes (`required`, `#email="ngModel"`, `*ngIf`/`@if` conditions on error state), template-driven forms are much harder to unit test in isolation — you typically need `TestBed.createComponent` plus `fixture.detectChanges()` and DOM queries rather than plain object assertions.
- Two-way binding (`[(ngModel)]`) syntax is easy to get subtly wrong — `[ngModel]` alone (one-way) silently stops writing back to the model, while `(ngModelChange)` alone stops reading from it; forgetting the banana-in-a-box brackets is a classic typo.
- `FormsModule` must be imported for `ngModel` to work at all — a very common "why isn't two-way binding working" bug is simply a missing import (in standalone components, missing it from the component's own `imports` array).
- Dynamic validation rules (e.g., "required only if another field has a certain value") are awkward — you end up conditionally toggling attributes like `[required]="someCondition"` rather than composing validator functions, which gets unwieldy fast.

## Interview Questions & Answers

**Q: Where does the "source of truth" live in a template-driven form, versus a reactive form?**
A: In the template. `FormsModule` watches for `ngModel` directives as the template renders and builds a hidden `FormControl` for each one, assembling them into an `NgForm`'s implicit `FormGroup`. There's no explicit model object in the component class — the structure of the form is entirely inferred from the DOM/template structure, which is the opposite of reactive forms, where the class-declared `FormGroup` is authoritative and the template only binds to it.

**Q: How do you access a specific control's validation state (e.g., "has the email field been touched and is it invalid") in a template-driven form?**
A: Export the `ngModel` directive on that element to a template reference variable, e.g. `#email="ngModel"`, then read `email.invalid`, `email.touched`, `email.dirty`, or `email.errors` directly in the template's conditional blocks. This is different from reactive forms, where you'd call `this.form.get('email')?.invalid` from the component class instead.

**Q: Why are template-driven forms considered less testable than reactive forms?**
A: Because the form model doesn't exist as a standalone object you can construct and assert on — it only comes into being as a side effect of Angular processing the rendered template. Testing it requires `TestBed.createComponent`, triggering change detection, and interacting with actual DOM elements (typing into inputs, dispatching events) to drive the hidden `ngModel` controls, rather than simply instantiating a `FormGroup` and calling `.setValue()`/checking `.valid` in a plain unit test, which is what reactive forms allow.

**Q: How do you implement a custom validator for a template-driven form, and how does that differ from reactive forms?**
A: You write a directive that implements the `Validator` interface (a `validate(control)` method returning `ValidationErrors | null`) and registers itself against the `NG_VALIDATORS` injection token with `multi: true`, then apply that directive as an attribute on the input element. In reactive forms, by contrast, a custom validator is just a plain function passed directly into the `FormControl`'s validators array — no directive, no DI token registration required. The directive wrapping is the extra ceremony template-driven forms impose to hook custom logic into the DOM-driven model-building process.

**Q: When would you deliberately choose template-driven forms over reactive forms?**
A: For small, mostly static forms with fixed validation rules — a login form, a simple search box, a one-off contact form — where writing an explicit `FormGroup` would be more code than the handful of `ngModel` bindings needed, and where you don't need to unit test the form logic in isolation or dynamically reshape the form at runtime. Once a form needs dynamic fields, cross-field validation, async validators, or real unit test coverage, reactive forms are the better fit.

## Related Topics

- [reactive-forms.md](./reactive-forms.md)
- [data-binding.md](./data-binding.md)
- [directives.md](./directives.md)
- [components.md](./components.md)
