use crate::hir::def_collector::dc_crate::CompilationError;
use crate::hir::resolution::errors::ResolverError;
use crate::tests::get_program_errors;

use super::assert_no_errors;

#[test]
fn trait_inheritance() {
    let src = r#"
        pub trait Foo {
            fn foo(self) -> Field;
        }

        pub trait Bar {
            fn bar(self) -> Field;
        }

        pub trait Baz: Foo + Bar {
            fn baz(self) -> Field;
        }

        pub fn foo<T>(baz: T) -> (Field, Field, Field) where T: Baz {
            (baz.foo(), baz.bar(), baz.baz())
        }

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics() {
    let src = r#"
        trait Foo<T> {
            fn foo(self) -> T;
        }

        trait Bar<U>: Foo<U> {
            fn bar(self);
        }

        pub fn foo<T>(x: T) -> i32 where T: Bar<i32> {
            x.foo()
        }

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics_2() {
    let src = r#"
        pub trait Foo<T> {
            fn foo(self) -> T;
        }

        pub trait Bar<T, U>: Foo<T> {
            fn bar(self) -> (T, U);
        }

        pub fn foo<T>(x: T) -> i32 where T: Bar<i32, i32> {
            x.foo()
        }

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics_3() {
    let src = r#"
        trait Foo<A> {}

        trait Bar<B>: Foo<B> {}

        impl Foo<i32> for () {}

        impl Bar<i32> for () {}

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics_4() {
    let src = r#"
        trait Foo { type A; }

        trait Bar<B>: Foo<A = B> {}

        impl Foo for () { type A = i32; }

        impl Bar<i32> for () {}

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_dependency_cycle() {
    let src = r#"
        trait Foo: Bar {}
        trait Bar: Foo {}
        fn main() {}
    "#;
    let errors = get_program_errors(src);
    assert_eq!(errors.len(), 1);

    assert!(matches!(
        errors[0].0,
        CompilationError::ResolverError(ResolverError::DependencyCycle { .. })
    ));
}

#[test]
fn trait_inheritance_missing_parent_implementation() {
    let src = r#"
        pub trait Foo {}

        pub trait Bar: Foo {}

        pub struct Struct {}

        impl Bar for Struct {}

        fn main() {
            let _ = Struct {}; // silence Struct never constructed warning
        }
    "#;
    let errors = get_program_errors(src);
    assert_eq!(errors.len(), 1);

    let CompilationError::ResolverError(ResolverError::TraitNotImplemented {
        impl_trait,
        missing_trait: the_trait,
        type_missing_trait: typ,
        ..
    }) = &errors[0].0
    else {
        panic!("Expected a TraitNotImplemented error, got {:?}", &errors[0].0);
    };

    assert_eq!(the_trait, "Foo");
    assert_eq!(typ, "Struct");
    assert_eq!(impl_trait, "Bar");
}

#[test]
fn errors_on_unknown_type_in_trait_where_clause() {
    let src = r#"
        pub trait Foo<T> where T: Unknown {}

        fn main() {
        }
    "#;
    let errors = get_program_errors(src);
    assert_eq!(errors.len(), 1);
}

#[test]
fn does_not_error_if_impl_trait_constraint_is_satisfied_for_concrete_type() {
    let src = r#"
        pub trait Greeter {
            fn greet(self);
        }

        pub trait Foo<T>
        where
            T: Greeter,
        {
            fn greet<U>(object: U)
            where
                U: Greeter,
            {
                object.greet();
            }
        }

        pub struct SomeGreeter;
        impl Greeter for SomeGreeter {
            fn greet(self) {}
        }

        pub struct Bar;

        impl Foo<SomeGreeter> for Bar {}

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn does_not_error_if_impl_trait_constraint_is_satisfied_for_type_variable() {
    let src = r#"
        pub trait Greeter {
            fn greet(self);
        }

        pub trait Foo<T> where T: Greeter {
            fn greet(object: T) {
                object.greet();
            }
        }

        pub struct Bar;

        impl<T> Foo<T> for Bar where T: Greeter {
        }

        fn main() {
        }
    "#;
    assert_no_errors(src);
}
#[test]
fn errors_if_impl_trait_constraint_is_not_satisfied() {
    let src = r#"
        pub trait Greeter {
            fn greet(self);
        }

        pub trait Foo<T>
        where
            T: Greeter,
        {
            fn greet<U>(object: U)
            where
                U: Greeter,
            {
                object.greet();
            }
        }

        pub struct SomeGreeter;

        pub struct Bar;

        impl Foo<SomeGreeter> for Bar {}

        fn main() {}
    "#;
    let errors = get_program_errors(src);
    assert_eq!(errors.len(), 1);

    let CompilationError::ResolverError(ResolverError::TraitNotImplemented {
        impl_trait,
        missing_trait: the_trait,
        type_missing_trait: typ,
        ..
    }) = &errors[0].0
    else {
        panic!("Expected a TraitNotImplemented error, got {:?}", &errors[0].0);
    };

    assert_eq!(the_trait, "Greeter");
    assert_eq!(typ, "SomeGreeter");
    assert_eq!(impl_trait, "Foo");
}

#[test]
// Regression test for https://github.com/noir-lang/noir/issues/6314
// Baz inherits from a single trait: Foo
fn regression_6314_single_inheritance() {
    let src = r#"
        trait Foo {
            fn foo(self) -> Self;
        }
        
        trait Baz: Foo {}
        
        impl<T> Baz for T where T: Foo {}
        
        fn main() { }
    "#;
    assert_no_errors(src);
}

#[test]
// Regression test for https://github.com/noir-lang/noir/issues/6314
// Baz inherits from two traits: Foo and Bar
fn regression_6314_double_inheritance() {
    let src = r#"
        trait Foo {
            fn foo(self) -> Self;
        }
       
        trait Bar {
            fn bar(self) -> Self;
        }
       
        trait Baz: Foo + Bar {}
       
        impl<T> Baz for T where T: Foo + Bar {}
       
        fn baz<T>(x: T) -> T where T: Baz {
            x.foo().bar()
        }
       
        impl Foo for Field {
            fn foo(self) -> Self {
                self + 1
            }
        }
       
        impl Bar for Field {
            fn bar(self) -> Self {
                self + 2
            }
        }
       
        fn main() {
            assert(0.foo().bar() == baz(0));
        }"#;

    assert_no_errors(src);
}

#[test]
fn removes_assumed_parent_traits_after_function_ends() {
    let src = r#"
    trait Foo {}
    trait Bar: Foo {}

    pub fn foo<T>()
    where
        T: Bar,
    {}

    pub fn bar<T>()
    where
        T: Foo,
    {}

    fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_bounds_which_are_dependent_on_generic_types_are_resolved_correctly() {
    // Regression test for https://github.com/noir-lang/noir/issues/6420
    let src = r#"
        trait Foo {
            fn foo() -> Field;
        }

        trait Bar<T>: Foo {
            fn bar(self) -> Field {
                self.foo()
            }
        }

        struct MyStruct<T> {
            inner: Field,
        }

        trait MarkerTrait {}
        impl MarkerTrait for Field {}

        // `MyStruct<T>` implements `Foo` only when its generic type `T` implements `MarkerTrait`.
        impl<T> Foo for MyStruct<T>
        where
            T: MarkerTrait,
        {
            fn foo() -> Field {
                42
            }
        }

        // We expect this to succeed as `MyStruct<T>` satisfies `Bar`'s trait bounds
        // of implementing `Foo` when `T` implements `MarkerTrait`.
        impl<T> Bar<T> for MyStruct<T>
        where
            T: MarkerTrait,
        {
            fn bar(self) -> Field {
                31415
            }
        }

        fn main() {
            let foo: MyStruct<Field> = MyStruct { inner: 42 };
            let _ = foo.bar();
        }
    "#;
    assert_no_errors(src);
}
