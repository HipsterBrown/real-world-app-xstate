import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from 'clsx';

type PaginationProps = {
  pageCount: number;
  limit: number;
  offset: number;
};

export const Pagination: React.FC<PaginationProps> = ({
  pageCount,
  limit,
  offset
}) => {
  const { search } = useLocation();

  return (
    <nav>
      <ul className="pagination">
        {new Array(pageCount).fill(1).map((page, index) => {
          const linkOffset = index * limit;
          const pageNum = index + page;
          const linkParams = new URLSearchParams(search);
          linkParams.set("offset", linkOffset.toString());

          return (
            <li
              className={clsx('page-item', offset === linkOffset && 'active')}
              key={pageNum}
            >
              <NavLink to={`?${linkParams.toString()}`} className="page-link">
                {pageNum}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
