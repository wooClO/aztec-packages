pub trait LeafPreimage {
    fn get_key(self) -> Field;
    fn as_leaf(self) -> Field;
}

pub trait IndexedTreeLeafPreimage {
    fn get_key(self) -> Field;
    fn get_next_key(self) -> Field;
    fn as_leaf(self) -> Field;
}
